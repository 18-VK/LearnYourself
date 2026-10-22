using System.Diagnostics;
using System.Runtime.InteropServices.JavaScript;
using Microsoft.CodeAnalysis;

namespace LearnYourself.Runner.Wasm;

/// <summary>
/// The worker-facing API. runner-worker.js calls these through [JSExport]; the C# side reports back through the
/// [JSImport] functions in the "runner-host" module (output chunks and phase changes), so the page sees output as it
/// is produced and knows when compilation ends and the timed part (running) begins.
///
/// Requests and results are JSON strings (see runner/NOTES.md, "Worker protocol"). New modes — the tracing
/// debugger's "debug" — add fields, not new entry points.
/// </summary>
public static partial class RunnerExports
{
    private static SnippetCompiler? _compiler;
    private static int _runs;

    [JSImport("output", "runner-host")]
    private static partial void Output(int requestId, string text);

    [JSImport("phase", "runner-host")]
    private static partial void Phase(int requestId, string phase, double ms);

    /// <summary>Loads the reference assemblies and warms Roslyn up. Returns JSON with timings.</summary>
    [JSExport]
    public static string Init()
    {
        var sw = Stopwatch.StartNew();
        RunnerCulture.Apply();
        var asm = typeof(RunnerExports).Assembly;
        var refs = new List<MetadataReference>();
        foreach (var name in asm.GetManifestResourceNames().Where(n => n.StartsWith("ref/", StringComparison.Ordinal)).Order(StringComparer.Ordinal))
        {
            using var s = asm.GetManifestResourceStream(name)!;
            refs.Add(MetadataReference.CreateFromStream(s, filePath: name[4..]));
        }
        _compiler = new SnippetCompiler(refs);
        var refMs = sw.Elapsed.TotalMilliseconds;
        return new Json().Begin().Prop("references", refs.Count).Prop("referencesMs", refMs).Prop("runtime", RuntimeInformationText()).End().ToString();
    }

    /// <summary>
    /// Compiles (without running) a small program that touches the same compiler paths as a lesson block, so the
    /// learner's first Run doesn't pay for Roslyn's first-use cost (several seconds in the WebAssembly interpreter).
    /// Called by the worker when the page asks for a warm start (the learner pressed Edit, or after a timeout).
    /// </summary>
    [JSExport]
    public static double WarmUp()
    {
        if (_compiler is null) Init();
        const string sample = """
            var xs = new List<int> { 3, 1, 2 };
            foreach (var x in xs.OrderBy(v => v)) Console.WriteLine($"{x}");
            """;
        var program = ProgramBuilder.Build(sample, null);
        return _compiler!.Compile(program).Milliseconds;
    }

    /// <summary>
    /// Builds, compiles and runs one program (the learner's code plus an optional harness, with stdin).
    /// The returned JSON has the build shape, the compiler's diagnostics and (if it compiled) the run result.
    /// </summary>
    [JSExport]
    public static async Task<string> Run(int id, string code, string? harness, string stdin, int maxOutput)
    {
        try
        {
            return await RunCore(id, code, harness, stdin, maxOutput);
        }
        catch (Exception e)
        {
            // a failure of the runner itself (not of the learner's program, whose exceptions are caught in RunAsync)
            return new Json().Begin().Prop("id", id).Prop("internalError", e.ToString()).End().ToString();
        }
    }

    private static async Task<string> RunCore(int id, string code, string? harness, string stdin, int maxOutput)
    {
        if (_compiler is null) Init();
        _runs++;
        var program = ProgramBuilder.Build(code, harness);
        var j = new Json().Begin().Prop("id", id).Prop("shape", program.Shape.ToString()).Prop("problem", program.Problem).Prop("runs", _runs);
        if (!program.CanRun)
        {
            Json.WriteDiagnostics(j, []);
            return j.Prop("compiled", false).End().ToString();
        }
        var compiled = _compiler!.Compile(program);
        Phase(id, compiled.Success ? "running" : "compiled", compiled.Milliseconds);
        j.Prop("compileMs", compiled.Milliseconds);
        Json.WriteDiagnostics(j, compiled.Diagnostics);
        j.Prop("compiled", compiled.Success);
        if (!compiled.Success) return j.End().ToString();
        var result = await SnippetExecutor.RunAsync(compiled.Assembly!, compiled.Pdb, stdin, new ExecutionLimits(maxOutput), text => Output(id, text));
        Json.WriteRun(j, result);
        return j.End().ToString();
    }

    private static string RuntimeInformationText() => System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription;
}
