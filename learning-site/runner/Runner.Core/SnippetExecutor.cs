using System.Collections.Immutable;
using System.Reflection;
using System.Reflection.Metadata;
using System.Reflection.Metadata.Ecma335;
using System.Runtime.Loader;
using System.Text;

namespace LearnYourself.Runner;

public sealed record ExecutionLimits(int MaxOutputChars = 64 * 1024)
{
    public static readonly ExecutionLimits Default = new();
}

public sealed record StackLine(string Method, string? File, int Line);

/// <summary>An exception that escaped the learner's Main: type, message and the learner's line it came from.</summary>
public sealed record RuntimeError(string Type, string Message, string? File, int Line, IReadOnlyList<StackLine> Stack);

/// <summary>
/// <c>completed</c>: Main returned; <c>exception</c>: an exception escaped Main; <c>output-limit</c>: the output cap
/// was hit and the program was stopped; <c>trace-limit</c>: the debugger's step, depth or size limit stopped it. (A timeout can't be reported from inside: the host terminates the worker
/// or process and reports <c>timeout</c> itself.)
/// </summary>
public sealed record RunResult(string Outcome, int ExitCode, RuntimeError? Error, bool OutputTruncated, double Milliseconds);

/// <summary>Thrown into the learner's program when it writes more than the output cap.</summary>
public sealed class OutputLimitExceededException(int limit)
    : Exception($"The program wrote more than {limit:N0} characters, so it was stopped.");

/// <summary>
/// Console.Out for a run: counts characters, enforces the cap, and hands text to <paramref name="sink"/> in chunks
/// (the browser posts each chunk to the page, so output produced before a timeout is not lost).
/// </summary>
public sealed class CappedWriter(int limit, Action<string> sink) : TextWriter
{
    private readonly StringBuilder _buffer = new();
    private int _written;
    private long _lastFlush = System.Diagnostics.Stopwatch.GetTimestamp();
    public bool LimitHit { get; private set; }
    /// <summary>Characters the program has written so far (including what is still buffered).</summary>
    public int Written => _written;
    public override Encoding Encoding => Encoding.UTF8;

    public override void Write(char value)
    {
        if (LimitHit) throw new OutputLimitExceededException(limit);
        if (_written >= limit)
        {
            LimitHit = true;
            Flush();
            throw new OutputLimitExceededException(limit);
        }
        _written++;
        _buffer.Append(value);
        if (value == '\n' && (_buffer.Length > 4096 || System.Diagnostics.Stopwatch.GetElapsedTime(_lastFlush).TotalMilliseconds > 50)) Flush();
    }

    public override void Write(string? value)
    {
        if (value is null) return;
        if (!LimitHit && _written + value.Length <= limit)
        {
            _written += value.Length;
            _buffer.Append(value);
            if (_buffer.Length > 4096 || (value.Contains('\n') && System.Diagnostics.Stopwatch.GetElapsedTime(_lastFlush).TotalMilliseconds > 50)) Flush();
            return;
        }
        foreach (var c in value) Write(c);
    }

    public override void Write(char[] buffer, int index, int count) => Write(new string(buffer, index, count));

    public override void Flush()
    {
        if (_buffer.Length == 0) return;
        var text = _buffer.ToString();
        _buffer.Clear();
        _lastFlush = System.Diagnostics.Stopwatch.GetTimestamp();
        sink(text);
    }
}

/// <summary>
/// Watches one run from the inside: the debugger's trace session (Debugger/TraceSession.cs) sets up the recorder that
/// the instrumenter compiled into the program before Main runs, and reads what it recorded afterwards.
/// </summary>
public interface IRunObserver
{
    /// <summary>Called after the program's assembly is loaded, before its entry point runs.</summary>
    void BeforeRun(Assembly program, Func<int> outputLength);

    /// <summary>Called when the run ends (also after an exception), before the assembly is unloaded.</summary>
    void AfterRun(Assembly program);

    /// <summary>The run's outcome for an exception that belongs to the observer (the debugger's step cap), or null.</summary>
    string? Outcome(Exception escaped);
}

/// <summary>
/// Loads a compiled snippet into its own AssemblyLoadContext and runs its entry point with Console redirected.
/// Used in the browser worker and in the build-time check's child process.
/// </summary>
public static class SnippetExecutor
{
    [System.Diagnostics.CodeAnalysis.UnconditionalSuppressMessage("Trimming", "IL2026", Justification = "The learner's assembly is compiled against reference assemblies whose implementations the browser bundle keeps untrimmed (References.props, RunnerKeep).")]
    [System.Diagnostics.CodeAnalysis.UnconditionalSuppressMessage("Trimming", "IL2075", Justification = "Reflection only over the learner's own (untrimmed) assembly.")]
    public static async Task<RunResult> RunAsync(byte[] assembly, byte[]? pdb, string stdin, ExecutionLimits limits, Action<string> output, IRunObserver? observer = null)
    {
        var started = System.Diagnostics.Stopwatch.GetTimestamp();
        var writer = new CappedWriter(limits.MaxOutputChars, output);
        var oldOut = Console.Out;
        var oldErr = Console.Error;
        // (reading Console.In throws PlatformNotSupportedException in the browser, so it is replaced, not saved)
        var context = CreateContext();
        Console.SetOut(writer);
        Console.SetError(writer);
        Console.SetIn(new StringReader(ProgramBuilder.Normalize(stdin)));
        int exitCode = 0;
        RuntimeError? error = null;
        string? observed = null;
        Assembly? asm = null;
        try
        {
            asm = pdb is null ? context.LoadFromStream(new MemoryStream(assembly)) : context.LoadFromStream(new MemoryStream(assembly), new MemoryStream(pdb));
            observer?.BeforeRun(asm, () => writer.Written);
            exitCode = await InvokeEntryPointAsync(asm);
        }
        catch (Exception e)
        {
            var ex = Unwrap(e);
            observed = observer?.Outcome(ex);
            if (ex is not OutputLimitExceededException && observed is null) error = Describe(ex, pdb);
            exitCode = ex is OutputLimitExceededException || observed is not null ? 0 : 1;
        }
        finally
        {
            try { writer.Flush(); } catch (OutputLimitExceededException) { }
            if (asm is not null) observer?.AfterRun(asm);
            Console.SetOut(oldOut);
            Console.SetError(oldErr);
            Console.SetIn(TextReader.Null);
            if (context.IsCollectible) context.Unload();
        }
        var outcome = writer.LimitHit ? "output-limit" : observed ?? (error is not null ? "exception" : "completed");
        return new RunResult(outcome, exitCode, error, writer.LimitHit, System.Diagnostics.Stopwatch.GetElapsedTime(started).TotalMilliseconds);
    }

    private static AssemblyLoadContext CreateContext()
    {
        try
        {
            return new AssemblyLoadContext("snippet", isCollectible: true);
        }
        catch (PlatformNotSupportedException)
        {
            return new AssemblyLoadContext("snippet", isCollectible: false);
        }
    }

    /// <summary>
    /// Runs Main. For an async Main (or top-level statements with <c>await</c>) the compiler's synchronous wrapper
    /// would block on the task, which a single-threaded WebAssembly runtime can't do, so the async method is awaited.
    /// </summary>
    [System.Diagnostics.CodeAnalysis.UnconditionalSuppressMessage("Trimming", "IL2026", Justification = "The learner's assembly is compiled against reference assemblies whose implementations the browser bundle keeps untrimmed (References.props, RunnerKeep).")]
    [System.Diagnostics.CodeAnalysis.UnconditionalSuppressMessage("Trimming", "IL2075", Justification = "Reflection only over the learner's own (untrimmed) assembly.")]
    private static async Task<int> InvokeEntryPointAsync(Assembly asm)
    {
        var entry = asm.EntryPoint ?? throw new InvalidOperationException("The program has no entry point.");
        var target = entry;
        if (entry.Name == "<Main>" && entry.DeclaringType is { } type)
        {
            target = type.GetMethods(BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic)
                .FirstOrDefault(m => m.Name is "Main" or "<Main>$" && typeof(Task).IsAssignableFrom(m.ReturnType)) ?? entry;
        }
        object?[]? args = target.GetParameters().Length == 1 ? [Array.Empty<string>()] : null;
        var result = target.Invoke(null, BindingFlags.DoNotWrapExceptions, binder: null, args, culture: null);
        switch (result)
        {
            case Task<int> ti:
                return await ti;
            case Task t:
                await t;
                return 0;
            case int code:
                return code;
            default:
                return 0;
        }
    }

    private static Exception Unwrap(Exception e)
    {
        while (e is TargetInvocationException { InnerException: { } inner }) e = inner;
        if (e is AggregateException { InnerExceptions.Count: 1 } agg) e = agg.InnerExceptions[0];
        return e;
    }

    /// <summary>Exception type, message, and the learner's file/line from the PDB (IL offset → sequence point).</summary>
    [System.Diagnostics.CodeAnalysis.UnconditionalSuppressMessage("Trimming", "IL2026", Justification = "The learner's assembly is compiled against reference assemblies whose implementations the browser bundle keeps untrimmed (References.props, RunnerKeep).")]
    [System.Diagnostics.CodeAnalysis.UnconditionalSuppressMessage("Trimming", "IL2075", Justification = "Reflection only over the learner's own (untrimmed) assembly.")]
    public static RuntimeError Describe(Exception ex, byte[]? pdb)
    {
        var stack = new List<StackLine>();
        var lines = pdb is null ? null : new PdbLines(pdb);
        foreach (var frame in new System.Diagnostics.StackTrace(ex, fNeedFileInfo: false).GetFrames())
        {
            var method = frame.GetMethod();
            if (method is null || method.Module.Assembly.GetName().Name != SnippetCompiler.AssemblyName) continue;
            var (file, line) = lines?.Find(method.MetadataToken, frame.GetILOffset()) ?? (null, 0);
            stack.Add(new StackLine(FriendlyName(method), file, line));
        }
        var top = stack.FirstOrDefault(s => s.Line > 0);
        return new RuntimeError(ex.GetType().FullName ?? ex.GetType().Name, ex.Message, top?.File, top?.Line ?? 0, stack);
    }

    /// <summary>Compiler-generated names (<c>&lt;Main&gt;$</c>, <c>&lt;&lt;Main&gt;$&gt;g__Foo|0_0</c>) shown the way the learner wrote them.</summary>
    public static string FriendlyName(MethodBase method)
    {
        // (string slicing rather than Regex keeps System.Text.RegularExpressions out of the browser bundle)
        var name = method.Name;
        if (name == "<Main>$") return "top-level statements";
        int g = name.IndexOf("g__", StringComparison.Ordinal);
        int bar = g < 0 ? -1 : name.IndexOf('|', g);
        if (bar > g) return name[(g + 3)..bar]; // local function: <<Main>$>g__BubbleSort|0_0
        var type = method.DeclaringType;
        while (type is not null && type.Name.StartsWith('<')) type = type.DeclaringType;
        if (name.StartsWith('<') && name.IndexOf('>') is > 1 and var close) name = name[1..close]; // <Run>b__0 (lambda) → Run
        return type is null || type.Name == "Program" && name == "Main" ? name : $"{type.Name}.{name}";
    }

    private sealed class PdbLines
    {
        private readonly MetadataReader? _reader;

        public PdbLines(byte[] pdb)
        {
            try
            {
                _reader = MetadataReaderProvider.FromPortablePdbImage(ImmutableArray.Create(pdb)).GetMetadataReader();
            }
            catch (BadImageFormatException)
            {
                _reader = null;
            }
        }

        public (string? File, int Line) Find(int methodToken, int ilOffset)
        {
            if (_reader is null || ilOffset < 0 || (methodToken >> 24) != 0x06) return (null, 0);
            var handle = MetadataTokens.MethodDefinitionHandle(methodToken & 0xFFFFFF);
            SequencePoint? best = null;
            foreach (var sp in _reader.GetMethodDebugInformation(handle).GetSequencePoints())
            {
                if (sp.IsHidden || sp.Offset > ilOffset) continue;
                if (best is null || sp.Offset >= best.Value.Offset) best = sp;
            }
            if (best is null) return (null, 0);
            var doc = _reader.GetDocument(best.Value.Document);
            return (_reader.GetString(doc.Name), best.Value.StartLine);
        }
    }
}
