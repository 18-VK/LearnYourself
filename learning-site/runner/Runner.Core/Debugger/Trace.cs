using System.Globalization;
using System.Reflection;
using System.Text;

namespace LearnYourself.Runner.Debugger;

/// <summary>Limits of a debug run (the page's 5 s timeout still applies on top of them).</summary>
public sealed record DebugLimits(int MaxSteps = 10_000, int MaxDepth = 1_000, int MaxValueChars = 4_000_000)
{
    public static readonly DebugLimits Default = new();
}

/// <summary>What the recorder collected, copied out of the program's assembly (see Recorder.cs.txt for the layout).</summary>
public sealed record RawTrace(int[] Events, string[] Values, int[][] Sets, int[] FrameSite, int[] FrameParent, string? Stopped, int StopOutput)
{
    public int EventCount => Events.Length / 5;
}

public enum StepKind
{
    /// <summary>A statement (or loop condition) is about to run.</summary>
    Line = 0,
    /// <summary>A method was entered; the variables are its parameters.</summary>
    Call = 1,
    /// <summary>A method is returning (with its return value, when it has one).</summary>
    Return = 2,
    /// <summary>An exception was thrown on the frame's current line.</summary>
    Exception = 3,
    /// <summary>The program finished.</summary>
    End = 4,
}

/// <summary>One step of the trace. <see cref="Vars"/> indexes <see cref="ExecutionTrace.VarLists"/>; <see cref="Value"/> indexes Values (-1: none).</summary>
public sealed record TraceStep(StepKind Kind, int Frame, int File, int Line, int Output, int Vars, int Value);

/// <summary>A call: which method (index into Methods), who called it, its depth (1 = the entry), and where the caller was.</summary>
public sealed record TraceFrame(int Method, int Parent, int Depth, int CallFile, int CallLine);

public sealed record TraceVariable(string Name, string Type, string Value);

/// <summary>
/// The trace the page replays: every step with its line, frame and variables. Values (JSON snapshots) and variable
/// lists are interned, so steps that change nothing cost a few numbers. <see cref="ToJson"/> is the worker protocol's
/// trace format (runner/NOTES.md, "Debugger").
/// </summary>
public sealed class ExecutionTrace
{
    public static readonly string[] Files = [ProgramBuilder.SnippetPath, ProgramBuilder.HarnessPath];
    public required IReadOnlyList<(string Name, string Type)> Names { get; init; }
    public required IReadOnlyList<string> Values { get; init; }
    /// <summary>Flattened (name, value) index pairs.</summary>
    public required IReadOnlyList<int[]> VarLists { get; init; }
    public required IReadOnlyList<TraceSite> Methods { get; init; }
    public required IReadOnlyList<TraceFrame> Frames { get; init; }
    public required IReadOnlyList<TraceStep> Steps { get; init; }
    /// <summary>null, or why recording stopped early: "steps", "depth" or "size".</summary>
    public string? Stop { get; init; }
    public int MaxSteps { get; init; }

    public IReadOnlyList<TraceVariable> VariablesAt(int step)
    {
        var pairs = VarLists[Steps[step].Vars];
        var list = new List<TraceVariable>(pairs.Length / 2);
        for (int i = 0; i + 1 < pairs.Length; i += 2) list.Add(new TraceVariable(Names[pairs[i]].Name, Names[pairs[i]].Type, Values[pairs[i + 1]]));
        return list;
    }

    /// <summary>Frame names from the current one down to the entry.</summary>
    public IReadOnlyList<string> StackAt(int step)
    {
        var names = new List<string>();
        for (int f = Steps[step].Frame; f >= 0; f = Frames[f].Parent) names.Add(Methods[Frames[f].Method].Name ?? "?");
        return names;
    }

    public int DepthAt(int step) => Frames[Steps[step].Frame].Depth;

    public string ToJson()
    {
        var sb = new StringBuilder(1024 + Steps.Count * 24);
        sb.Append("{\"v\":1,\"maxSteps\":").Append(Num(MaxSteps)).Append(",\"stop\":").Append(Stop is null ? "null" : Quote(Stop));
        sb.Append(",\"files\":[").Append(string.Join(",", Files.Select(Quote))).Append(']');
        sb.Append(",\"names\":[");
        for (int i = 0; i < Names.Count; i++) sb.Append(i > 0 ? "," : "").Append('[').Append(Quote(Names[i].Name)).Append(',').Append(Quote(Names[i].Type)).Append(']');
        sb.Append("],\"values\":[");
        for (int i = 0; i < Values.Count; i++) sb.Append(i > 0 ? "," : "").Append(Values[i]);
        sb.Append("],\"vars\":[");
        for (int i = 0; i < VarLists.Count; i++) sb.Append(i > 0 ? "," : "").Append('[').Append(string.Join(",", VarLists[i].Select(Num))).Append(']');
        sb.Append("],\"methods\":[");
        for (int i = 0; i < Methods.Count; i++)
        {
            var m = Methods[i];
            sb.Append(i > 0 ? "," : "").Append("{\"name\":").Append(Quote(m.Name ?? "?")).Append(",\"file\":").Append(Num(m.File)).Append(",\"line\":").Append(Num(m.Line))
                .Append(",\"endLine\":").Append(Num(m.EndLine)).Append(",\"entry\":").Append(m.Entry ? "true" : "false");
            if (m.IndexHints is { Count: > 0 } hints)
            {
                sb.Append(",\"hints\":{");
                sb.Append(string.Join(",", hints.Select(h => Quote(h.Key) + ":[" + string.Join(",", h.Value.Select(Quote)) + "]")));
                sb.Append('}');
            }
            sb.Append('}');
        }
        sb.Append("],\"frames\":[");
        for (int i = 0; i < Frames.Count; i++)
        {
            var f = Frames[i];
            sb.Append(i > 0 ? "," : "").Append('[').Append(Num(f.Method)).Append(',').Append(Num(f.Parent)).Append(',').Append(Num(f.Depth)).Append(',').Append(Num(f.CallFile)).Append(',').Append(Num(f.CallLine)).Append(']');
        }
        sb.Append("],\"steps\":[");
        for (int i = 0; i < Steps.Count; i++)
        {
            var s = Steps[i];
            sb.Append(i > 0 ? "," : "").Append('[').Append(Num((int)s.Kind)).Append(',').Append(Num(s.Frame)).Append(',').Append(Num(s.File)).Append(',').Append(Num(s.Line))
                .Append(',').Append(Num(s.Output)).Append(',').Append(Num(s.Vars)).Append(',').Append(Num(s.Value)).Append(']');
        }
        sb.Append("]}");
        return sb.ToString();
    }

    private static string Num(int n) => n.ToString(CultureInfo.InvariantCulture);

    private static string Quote(string s)
    {
        var j = new Json();
        j.Value(s);
        return j.ToString();
    }
}

/// <summary>Turns the recorder's events into steps: call / line / return / exception / end, each with its frame's variables.</summary>
public static class TraceBuilder
{
    public static ExecutionTrace Build(IReadOnlyList<TraceSite> sites, RawTrace raw, DebugLimits limits)
    {
        var names = new List<(string, string)>();
        var nameIds = new Dictionary<(string, string), int>();
        var varLists = new List<int[]> { Array.Empty<int>() };
        var varIds = new Dictionary<string, int> { [""] = 0 };
        var methods = new List<TraceSite>();
        var methodIds = new Dictionary<int, int>();
        var frames = new List<TraceFrame>();
        var steps = new List<TraceStep>();
        var lastVars = new Dictionary<int, int>();
        var lastLoc = new Dictionary<int, (int File, int Line)>();
        var returned = new HashSet<int>();

        int Name(SiteVariable v)
        {
            var key = (v.Name, v.Type);
            if (!nameIds.TryGetValue(key, out int id))
            {
                id = names.Count;
                names.Add(key);
                nameIds[key] = id;
            }
            return id;
        }
        int Vars(IReadOnlyList<SiteVariable> vars, int set)
        {
            if (set < 0 || set >= raw.Sets.Length || vars.Count == 0) return 0;
            var values = raw.Sets[set];
            int n = Math.Min(values.Length, vars.Count);
            var pairs = new int[n * 2];
            for (int i = 0; i < n; i++)
            {
                pairs[2 * i] = Name(vars[i]);
                pairs[2 * i + 1] = values[i];
            }
            var key = string.Join(",", pairs);
            if (!varIds.TryGetValue(key, out int id))
            {
                id = varLists.Count;
                varLists.Add(pairs);
                varIds[key] = id;
            }
            return id;
        }
        int Method(int site)
        {
            if (!methodIds.TryGetValue(site, out int id))
            {
                id = methods.Count;
                methods.Add(sites[site]);
                methodIds[site] = id;
            }
            return id;
        }
        TraceSite? Site(int id) => id >= 0 && id < sites.Count ? sites[id] : null;

        var e = raw.Events;
        for (int i = 0; i + 4 < e.Length; i += 5)
        {
            int kind = e[i], frame = e[i + 1], siteId = e[i + 2], output = e[i + 3], payload = e[i + 4];
            switch (kind)
            {
                case 1: // Enter
                {
                    var m = Site(siteId);
                    if (m is null) continue;
                    while (frames.Count <= frame) frames.Add(new TraceFrame(0, -1, 1, 0, 0));
                    int parent = frame < raw.FrameParent.Length ? raw.FrameParent[frame] : -1;
                    var call = parent >= 0 && lastLoc.TryGetValue(parent, out var loc) ? loc : (0, 0);
                    frames[frame] = new TraceFrame(Method(siteId), parent, parent >= 0 && parent < frames.Count ? frames[parent].Depth + 1 : 1, call.Item1, call.Item2);
                    int vars = Vars(m.Variables, payload);
                    lastVars[frame] = vars;
                    lastLoc[frame] = (m.File, m.Line);
                    if (!m.Entry) steps.Add(new TraceStep(StepKind.Call, frame, m.File, m.Line, output, vars, -1));
                    break;
                }
                case 2: // Step
                {
                    var s = Site(siteId);
                    if (s is null || frame >= frames.Count) continue;
                    int vars = Vars(s.Variables, payload);
                    lastVars[frame] = vars;
                    lastLoc[frame] = (s.File, s.Line);
                    steps.Add(new TraceStep(StepKind.Line, frame, s.File, s.Line, output, vars, -1));
                    break;
                }
                case 3: // Ret
                {
                    var s = Site(siteId);
                    if (s is null || frame >= frames.Count) continue;
                    returned.Add(frame);
                    steps.Add(new TraceStep(StepKind.Return, frame, s.File, s.Line, output, lastVars.GetValueOrDefault(frame), payload));
                    break;
                }
                case 4: // Thrown
                {
                    if (frame < 0 || frame >= frames.Count) continue;
                    var (file, line) = lastLoc.GetValueOrDefault(frame);
                    steps.Add(new TraceStep(StepKind.Exception, frame, file, line, output, lastVars.GetValueOrDefault(frame), payload));
                    break;
                }
                case 5: // Exit
                {
                    var m = Site(siteId);
                    if (m is null || frame >= frames.Count || payload != 0) continue; // payload 1: an exception is leaving
                    if (m.Entry) steps.Add(new TraceStep(StepKind.End, frame, m.File, 0, output, lastVars.GetValueOrDefault(frame), -1));
                    else if (!returned.Contains(frame)) steps.Add(new TraceStep(StepKind.Return, frame, m.File, m.EndLine, output, lastVars.GetValueOrDefault(frame), -1));
                    break;
                }
            }
        }
        return new ExecutionTrace
        {
            Names = names,
            Values = raw.Values,
            VarLists = varLists,
            Methods = methods,
            Frames = frames,
            Steps = steps,
            Stop = raw.Stopped,
            MaxSteps = limits.MaxSteps,
        };
    }
}

/// <summary>
/// One debug run: sets the recorder's limits and hooks before Main, and reads what it recorded afterwards
/// (or at the moment a limit stops the program, so the page gets the trace even if the program then keeps running).
/// </summary>
public sealed class TraceSession(IReadOnlyList<TraceSite>? sites, DebugLimits limits, Action<string>? onStop = null) : IRunObserver
{
    public const string RecorderTypeName = "LyDebug.Recorder";
    private Type? _recorder;

    public RawTrace? Raw { get; private set; }
    /// <summary>True when the trace was already handed to <c>onStop</c> (a limit was hit).</summary>
    public bool StopReported { get; private set; }

    public ExecutionTrace? Trace => sites is null || Raw is null ? null : TraceBuilder.Build(sites, Raw, limits);

    [System.Diagnostics.CodeAnalysis.UnconditionalSuppressMessage("Trimming", "IL2026", Justification = "Reflection over the learner's own (untrimmed) assembly.")]
    [System.Diagnostics.CodeAnalysis.UnconditionalSuppressMessage("Trimming", "IL2075", Justification = "Reflection over the learner's own (untrimmed) assembly.")]
    public void BeforeRun(Assembly program, Func<int> outputLength)
    {
        _recorder = program.GetType(RecorderTypeName);
        if (_recorder is null) return;
        Set("MaxEvents", limits.MaxSteps);
        Set("MaxDepth", limits.MaxDepth);
        Set("MaxValueChars", limits.MaxValueChars);
        Set("OutputLength", outputLength);
        Set("OnStop", (Action)Stopped);
    }

    public void AfterRun(Assembly program)
    {
        if (_recorder is not null) Raw = Read();
    }

    public string? Outcome(Exception escaped) => escaped.GetType().FullName == RecorderTypeName + "+StopException" ? "trace-limit" : null;

    private void Stopped()
    {
        Raw = Read();
        if (onStop is null || sites is null) return;
        onStop(TraceBuilder.Build(sites, Raw, limits).ToJson());
        StopReported = true;
    }

    [System.Diagnostics.CodeAnalysis.UnconditionalSuppressMessage("Trimming", "IL2080", Justification = "Reflection over the learner's own (untrimmed) assembly.")]
    private void Set(string field, object value) => _recorder!.GetField(field, BindingFlags.Public | BindingFlags.Static)?.SetValue(null, value);

    [System.Diagnostics.CodeAnalysis.UnconditionalSuppressMessage("Trimming", "IL2080", Justification = "Reflection over the learner's own (untrimmed) assembly.")]
    private object? Get(string field) => _recorder!.GetField(field, BindingFlags.Public | BindingFlags.Static)?.GetValue(null);

    private RawTrace Read() => new(
        [.. (List<int>)Get("Events")!],
        [.. (List<string>)Get("Values")!],
        [.. (List<int[]>)Get("Sets")!],
        [.. (List<int>)Get("FrameSite")!],
        [.. (List<int>)Get("FrameParent")!],
        (string?)Get("Stopped"),
        (int)Get("StopOutput")!);
}

/// <summary>The result of compiling a program for the debugger.</summary>
/// <param name="Compiled">The learner's code as compiled without instrumentation: its diagnostics are what the learner sees.</param>
/// <param name="Level">The instrumentation level that compiled (2 = full, 1 = no conditions/returns/caught exceptions, 0 = no variables); -1 if none did.</param>
/// <param name="Error">Why no level compiled (an instrumenter limitation), or null.</param>
public sealed record DebugBuild(CompileResult Compiled, byte[]? Assembly, byte[]? Pdb, IReadOnlyList<TraceSite> Sites, int Level, string? Error, double InstrumentMs)
{
    public bool CanRun => Compiled.Success && Assembly is not null;
}

public static class DebugCompiler
{
    /// <summary>
    /// Compiles the learner's code as written (diagnostics, as Run shows them), then instruments it, trying level 2,
    /// then 1, then 0, and keeps the first that compiles.
    /// </summary>
    public static DebugBuild Compile(SnippetCompiler compiler, BuiltProgram program)
    {
        var started = System.Diagnostics.Stopwatch.GetTimestamp();
        var compilation = compiler.CreateCompilation(program);
        var diagnostics = SnippetCompiler.Sort(compilation.GetDiagnostics().Where(d => d.Severity is Microsoft.CodeAnalysis.DiagnosticSeverity.Error or Microsoft.CodeAnalysis.DiagnosticSeverity.Warning));
        var compileMs = System.Diagnostics.Stopwatch.GetElapsedTime(started).TotalMilliseconds;
        if (diagnostics.Any(d => d.Severity == "error")) return new DebugBuild(new CompileResult(false, diagnostics, null, null, compileMs), null, null, [], -1, null, 0);
        string? error = null;
        for (int level = 2; level >= 0; level--)
        {
            var at = System.Diagnostics.Stopwatch.GetTimestamp();
            try
            {
                var instrumenter = new Instrumenter(program.Shape, level);
                var emitted = SnippetCompiler.Emit(instrumenter.Transform(compilation), at);
                if (emitted.Success)
                {
                    var ms = System.Diagnostics.Stopwatch.GetElapsedTime(started).TotalMilliseconds;
                    return new DebugBuild(new CompileResult(true, diagnostics, emitted.Assembly, emitted.Pdb, ms), emitted.Assembly, emitted.Pdb, instrumenter.Sites, level, null, ms - compileMs);
                }
                error ??= emitted.Errors.Select(d => $"{d.Id}: {d.Message} (line {d.Line})").FirstOrDefault();
            }
            catch (Exception e)
            {
                error ??= $"{e.GetType().Name}: {e.Message}";
            }
        }
        var total = System.Diagnostics.Stopwatch.GetElapsedTime(started).TotalMilliseconds;
        return new DebugBuild(new CompileResult(true, diagnostics, null, null, total), null, null, [], -1, error ?? "the instrumented program did not compile", total - compileMs);
    }
}
