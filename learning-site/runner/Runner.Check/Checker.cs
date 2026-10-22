using System.Collections.Concurrent;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;

namespace LearnYourself.Runner.Check;

/// <summary>
/// The decision for one program, in this order (the first that applies wins):
/// 1. forced off in the lesson's YAML;
/// 2. compiled against the full .NET reference set, the semantic model shows it needs something a browser can't give
///    (see <see cref="Classifier"/>), unless forced on;
/// 3. it doesn't compile as a console program (with the SDK's implicit usings);
/// 4. it only declares types or methods and has no harness;
/// 5. it doesn't compile against the browser runner's smaller reference set;
/// otherwise it is a candidate, and <see cref="BatchRunner"/> runs it twice to record its output.
/// </summary>
public sealed class Checker
{
    private readonly SnippetCompiler _full;
    private readonly SnippetCompiler _runner;
    private readonly HashSet<string> _runnerAssemblies;

    public Checker(string refsDir)
    {
        var fullRefs = LoadDir(Path.Combine(refsDir, "netcore")).Concat(AspNetReferences()).ToList();
        var runnerRefs = LoadDir(Path.Combine(refsDir, "runner")).ToList();
        if (runnerRefs.Count == 0) throw new InvalidOperationException($"No reference assemblies in {refsDir}/runner. Build Runner.Check first.");
        _full = new SnippetCompiler(fullRefs);
        _runner = new SnippetCompiler(runnerRefs);
        _runnerAssemblies = [.. runnerRefs.Select(r => Path.GetFileNameWithoutExtension(r.Display!))];
        ReferenceNames = [.. _runnerAssemblies.Order()];
    }

    public List<string> ReferenceNames { get; }

    private static IEnumerable<MetadataReference> LoadDir(string dir) =>
        Directory.Exists(dir) ? Directory.GetFiles(dir, "*.dll").Order(StringComparer.Ordinal).Select(f => MetadataReference.CreateFromFile(f)) : [];

    /// <summary>
    /// The ASP.NET Core reference pack that ships with the SDK, so ASP.NET Core blocks are recognised by their symbols.
    /// Optional: without it they are still excluded, as "does not compile".
    /// </summary>
    private static IEnumerable<MetadataReference> AspNetReferences()
    {
        var runtimeDir = System.Runtime.InteropServices.RuntimeEnvironment.GetRuntimeDirectory();
        var root = Path.GetFullPath(Path.Combine(runtimeDir, "..", "..", ".."));
        var pack = Path.Combine(root, "packs", "Microsoft.AspNetCore.App.Ref");
        if (!Directory.Exists(pack)) return [];
        var major = Environment.Version.Major;
        var dir = Directory.GetDirectories(pack)
            .Select(d => (d, v: Version.TryParse(Path.GetFileName(d).Split('-')[0], out var v) ? v : null))
            .Where(x => x.v?.Major == major)
            .OrderByDescending(x => x.v)
            .Select(x => Path.Combine(x.d, "ref", $"net{major}.0"))
            .FirstOrDefault(Directory.Exists);
        return dir is null ? [] : LoadDir(dir);
    }

    public CheckVerdict Analyze(CheckProgram p)
    {
        if (p.Force == "off") return Excluded(p, "forced-off", p.ForceReason ?? "turned off in the lesson's runnable file");

        var program = ProgramBuilder.Build(p.Code, p.Harness);
        if (program.Problem is not null) return Excluded(p, "compile-error", program.Problem, program.Shape);

        // Classification: compile against everything .NET ships, so every symbol resolves. (A missing Main, CS5001,
        // is not a reason here: declaration-only blocks are reported as "no-entry-point" below.)
        var classify = _full.CreateCompilation(program);
        var used = Classifier.UsedAssemblies(classify).ToList();
        if (p.Force != "on" && Classifier.Classify(classify) is { } ex) return Excluded(p, ex.Category, ex.Reason, program.Shape, used);
        var errors = classify.GetDiagnostics().Where(d => d.Severity == DiagnosticSeverity.Error && d.Id != "CS5001").Select(SnippetCompiler.ToDiagnostic).ToList();
        if (errors.Count > 0) return Excluded(p, "compile-error", $"{errors[0].Id}: {errors[0].Message}", program.Shape, used, errors);
        if (!program.CanRun) return Excluded(p, "no-entry-point", "declares types or methods but has no Main and no harness", program.Shape, used);

        // The real thing: the browser's reference set, as a console program.
        var compiled = _runner.Compile(program);
        if (!compiled.Success)
        {
            var missing = used.Where(a => !_runnerAssemblies.Contains(a) && a != "System.Private.CoreLib").ToList();
            var reason = missing.Count > 0 ? $"uses {string.Join(", ", missing)}" : $"{compiled.Errors.First().Id}: {compiled.Errors.First().Message}";
            return Excluded(p, missing.Count > 0 ? "not-in-runner" : "compile-error", reason, program.Shape, used, [.. compiled.Errors]);
        }
        var readsInput = Classifier.ReadsInput(_runner.CreateCompilation(program));
        return new CheckVerdict
        {
            Id = p.Id,
            Runnable = true,
            Shape = program.Shape.ToString(),
            ReadsInput = readsInput,
            Assemblies = used,
            Assembly = compiled.Assembly,
            Pdb = compiled.Pdb,
        };
    }

    private static CheckVerdict Excluded(CheckProgram p, string category, string reason, ProgramShape? shape = null, List<string>? used = null, List<CompileDiagnostic>? diagnostics = null) => new()
    {
        Id = p.Id,
        Runnable = false,
        Category = category,
        Reason = reason,
        Shape = shape?.ToString(),
        Assemblies = used ?? [],
        Diagnostics = diagnostics?.Take(3).ToList() ?? [],
    };

    /// <summary>Analyzes every program (in parallel; Roslyn compilations are independent) in input order.</summary>
    public List<CheckVerdict> AnalyzeAll(IReadOnlyList<CheckProgram> programs, int jobs)
    {
        var results = new CheckVerdict[programs.Count];
        var errors = new ConcurrentBag<Exception>();
        Parallel.For(0, programs.Count, new ParallelOptions { MaxDegreeOfParallelism = jobs }, i =>
        {
            try
            {
                results[i] = Analyze(programs[i]);
            }
            catch (Exception e)
            {
                results[i] = Excluded(programs[i], "compile-error", $"the check failed: {e.GetType().Name}: {e.Message}");
                errors.Add(e);
            }
        });
        return [.. results];
    }
}
