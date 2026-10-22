using System.Collections.Immutable;
using System.Text;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.Emit;
using Microsoft.CodeAnalysis.Text;

namespace LearnYourself.Runner;

/// <summary>A compiler message, positioned in the file the learner sees (after <c>#line</c> mapping).</summary>
public sealed record CompileDiagnostic(string Id, string Severity, string Message, string File, int Line, int Column, int EndLine, int EndColumn);

public sealed record CompileResult(bool Success, IReadOnlyList<CompileDiagnostic> Diagnostics, byte[]? Assembly, byte[]? Pdb, double Milliseconds)
{
    public IEnumerable<CompileDiagnostic> Errors => Diagnostics.Where(d => d.Severity == "error");
}

/// <summary>
/// Optional step between parsing and emitting. The tracing debugger plugs its instrumenter in here
/// (a syntax rewriter that records lines, locals and calls); a plain run uses no transform.
/// </summary>
public delegate CSharpCompilation CompilationTransform(CSharpCompilation compilation);

/// <summary>
/// Compiles a <see cref="BuiltProgram"/> to an in-memory console assembly with a portable PDB.
/// The same class runs in the browser (Mono on WebAssembly) and in the build-time check (CoreCLR), with the same
/// reference assemblies, so "it compiled in CI" means "it compiles in the browser".
/// </summary>
public sealed class SnippetCompiler
{
    public const string AssemblyName = "Snippet";
    private readonly ImmutableArray<MetadataReference> _references;

    public SnippetCompiler(IEnumerable<MetadataReference> references) => _references = [.. references];

    public int ReferenceCount => _references.Length;

    public static readonly CSharpCompilationOptions Options = new CSharpCompilationOptions(OutputKind.ConsoleApplication)
        .WithOptimizationLevel(OptimizationLevel.Debug)
        .WithNullableContextOptions(NullableContextOptions.Disable)
        .WithAllowUnsafe(false)
        .WithOverflowChecks(false)
        .WithDeterministic(true)
        // WebAssembly is single-threaded: Roslyn must not try to bind/emit in parallel.
        .WithConcurrentBuild(false)
        .WithSpecificDiagnosticOptions(new Dictionary<string, ReportDiagnostic>
        {
            // usings.cs imports namespaces a block may not use
            ["CS8019"] = ReportDiagnostic.Suppress,
            ["CS8933"] = ReportDiagnostic.Suppress,
        });

    public CSharpCompilation CreateCompilation(BuiltProgram program)
    {
        var trees = program.Documents.Select(d => ParseDocument(d));
        return CSharpCompilation.Create(AssemblyName, trees, _references, Options);
    }

    /// <summary>
    /// Each tree gets an empty file path and names its file with a leading <c>#line 1 "snippet.cs"</c> instead.
    /// Why: when emitting a PDB, Roslyn computes the checksum of every tree that has a path with <c>Task.Run</c> and
    /// then blocks on the result. On single-threaded WebAssembly that wait throws ("Cannot wait on monitors on this
    /// runtime"). Files named only by <c>#line</c> get no checksum, so nothing is queued; diagnostics, sequence points
    /// and stack traces still report "snippet.cs" with the learner's line numbers.
    /// </summary>
    public static SyntaxTree ParseDocument(SourceDocument d) =>
        CSharpSyntaxTree.ParseText(SourceText.From($"#line 1 \"{d.Path}\"\n{d.Text}", Encoding.UTF8), ProgramBuilder.ParseOptions, path: "");

    /// <summary>The document a tree came from (its leading <c>#line</c> name).</summary>
    public static string DocumentPath(SyntaxTree tree)
    {
        var span = tree.GetMappedLineSpan(new TextSpan(tree.Length > 0 ? Math.Min(tree.Length - 1, tree.GetText().Lines[0].End + 1) : 0, 0));
        return span.Path;
    }

    public CompileResult Compile(BuiltProgram program, CompilationTransform? transform = null)
    {
        var started = System.Diagnostics.Stopwatch.GetTimestamp();
        var compilation = CreateCompilation(program);
        if (transform is not null) compilation = transform(compilation);
        using var pe = new MemoryStream();
        using var pdb = new MemoryStream();
        var emit = compilation.Emit(pe, pdb, options: new EmitOptions(debugInformationFormat: DebugInformationFormat.PortablePdb));
        var diagnostics = emit.Diagnostics
            .Where(d => d.Severity is DiagnosticSeverity.Error or DiagnosticSeverity.Warning)
            .Select(ToDiagnostic)
            .OrderBy(d => d.Severity == "error" ? 0 : 1).ThenBy(d => d.File).ThenBy(d => d.Line).ThenBy(d => d.Column)
            .ToList();
        var ms = System.Diagnostics.Stopwatch.GetElapsedTime(started).TotalMilliseconds;
        return emit.Success
            ? new CompileResult(true, diagnostics, pe.ToArray(), pdb.ToArray(), ms)
            : new CompileResult(false, diagnostics, null, null, ms);
    }

    public static CompileDiagnostic ToDiagnostic(Diagnostic d)
    {
        var span = d.Location.IsInSource ? d.Location.GetMappedLineSpan() : default;
        var file = d.Location.IsInSource ? span.Path : "";
        return new CompileDiagnostic(
            d.Id,
            d.Severity == DiagnosticSeverity.Error ? "error" : "warning",
            d.GetMessage(System.Globalization.CultureInfo.InvariantCulture),
            file,
            d.Location.IsInSource ? span.StartLinePosition.Line + 1 : 0,
            d.Location.IsInSource ? span.StartLinePosition.Character + 1 : 0,
            d.Location.IsInSource ? span.EndLinePosition.Line + 1 : 0,
            d.Location.IsInSource ? span.EndLinePosition.Character + 1 : 0);
    }
}
