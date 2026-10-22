using System.Collections.Immutable;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace LearnYourself.Runner.Check;

/// <summary>Why a block has no Run button. The id is what the site and the report use.</summary>
public sealed record Exclusion(string Category, string Reason);

/// <summary>
/// Decides from Roslyn's semantic model (the symbols a block actually binds to, not its text) whether a block
/// belongs to something a browser can't run: ASP.NET Core, WPF/WinForms, databases, the file system, the network,
/// threads/async, the host process, or APIs .NET marks <c>[UnsupportedOSPlatform("browser")]</c>.
/// </summary>
public sealed class Classifier
{
    /// <summary>Category ids, in the order they are reported (the first that applies wins).</summary>
    public static readonly string[] Categories =
    [
        "forced-off", "aspnet", "desktop", "database", "network", "filesystem", "threading", "host", "browser-unsupported",
        "package", "compile-error", "no-entry-point", "not-in-runner", "timeout", "crash",
    ];

    public static readonly IReadOnlyDictionary<string, string> Labels = new Dictionary<string, string>
    {
        ["forced-off"] = "turned off in src/data/runnable",
        ["aspnet"] = "ASP.NET Core / hosting",
        ["desktop"] = "WPF / WinForms",
        ["database"] = "database / EF Core",
        ["network"] = "network",
        ["filesystem"] = "file system",
        ["threading"] = "threads, tasks, async, locks or timers (WebAssembly is single-threaded)",
        ["host"] = "the host process or machine (Process, Environment)",
        ["browser-unsupported"] = "an API .NET does not support in the browser",
        ["package"] = "a NuGet package",
        ["compile-error"] = "does not compile as a console program",
        ["no-entry-point"] = "declarations only, with no harness",
        ["not-in-runner"] = "an assembly the browser runner does not include",
        ["timeout"] = "did not finish within the time limit",
        ["crash"] = "crashed the process",
    };

    private static readonly (string Prefix, string Category)[] NamespaceRules =
    [
        ("Microsoft.AspNetCore", "aspnet"),
        ("Microsoft.Extensions", "aspnet"),
        ("Microsoft.JSInterop", "aspnet"),
        ("System.Windows", "desktop"),
        ("Microsoft.Win32", "desktop"),
        ("System.Drawing", "desktop"),
        ("System.Data", "database"),
        ("Microsoft.Data", "database"),
        ("Microsoft.EntityFrameworkCore", "database"),
        ("System.Transactions", "database"),
        ("System.Net", "network"),
        ("System.Threading", "threading"),
        ("System.Timers", "threading"),
        ("System.Diagnostics.Process", "host"),
    ];

    /// <summary>Using directives for packages no reference set contains: the namespace says what the block needs.</summary>
    private static readonly (string Prefix, string Category)[] PackageRules =
    [
        ("Microsoft.EntityFrameworkCore", "database"),
        ("Microsoft.Data", "database"),
        ("System.Data", "database"),
        ("Dapper", "database"),
        ("Npgsql", "database"),
        ("MySql", "database"),
        ("StackExchange.Redis", "database"),
        ("System.Windows", "desktop"),
        ("Microsoft.Win32", "desktop"),
        ("CommunityToolkit.Mvvm", "desktop"),
        ("Microsoft.AspNetCore", "aspnet"),
        ("Microsoft.Extensions", "aspnet"),
        ("Swashbuckle", "aspnet"),
        ("Serilog", "aspnet"),
    ];

    /// <summary>System.IO types that don't touch the file system (Console.In/Out are TextReader/TextWriter).</summary>
    private static readonly HashSet<string> InMemoryIo =
    [
        "TextReader", "TextWriter", "StringReader", "StringWriter", "MemoryStream", "Stream", "BufferedStream", "BinaryReader", "BinaryWriter",
        "IOException", "EndOfStreamException", "InvalidDataException", "SeekOrigin",
    ];

    /// <summary>Environment members that are the same everywhere; every other one reads the host.</summary>
    private static readonly HashSet<string> PortableEnvironment = ["NewLine", "Version", "Is64BitProcess", "TickCount", "TickCount64"];

    /// <summary>
    /// The first exclusion that applies to the compiled block, or null. <paramref name="compilation"/> must be compiled
    /// against the full reference set, so every BCL symbol resolves and its namespace and attributes are known.
    /// </summary>
    public static Exclusion? Classify(CSharpCompilation compilation)
    {
        var found = new SortedDictionary<int, Exclusion>();
        void Add(string category, string reason)
        {
            int order = Array.IndexOf(Categories, category);
            found.TryAdd(order, new Exclusion(category, reason));
        }

        foreach (var tree in compilation.SyntaxTrees)
        {
            if (SnippetCompiler.DocumentPath(tree) == ProgramBuilder.UsingsPath) continue;
            var model = compilation.GetSemanticModel(tree);
            var root = tree.GetRoot();

            foreach (var u in root.DescendantNodes().OfType<UsingDirectiveSyntax>())
            {
                if (u.Name is null || u.StaticKeyword.IsKind(SyntaxKind.StaticKeyword) || u.Alias is not null) continue;
                var name = u.Name.ToString();
                var symbol = model.GetSymbolInfo(u.Name).Symbol;
                if (symbol is null)
                {
                    var rule = PackageRules.FirstOrDefault(r => name == r.Prefix || name.StartsWith(r.Prefix + ".", StringComparison.Ordinal));
                    Add(rule.Category ?? "package", $"uses {name}, which is not part of .NET's base library");
                }
                else
                {
                    var rule = NamespaceRules.FirstOrDefault(r => name == r.Prefix || name.StartsWith(r.Prefix + ".", StringComparison.Ordinal));
                    if (rule.Category is not null && rule.Category != "threading") Add(rule.Category, $"imports {name}");
                }
            }

            foreach (var node in root.DescendantNodes())
            {
                switch (node)
                {
                    case LockStatementSyntax:
                        Add("threading", "uses a lock statement");
                        continue;
                    case AwaitExpressionSyntax:
                        Add("threading", "uses await");
                        continue;
                    case IdentifierNameSyntax or GenericNameSyntax or MemberAccessExpressionSyntax or ObjectCreationExpressionSyntax
                        or ImplicitObjectCreationExpressionSyntax or InvocationExpressionSyntax or ElementAccessExpressionSyntax:
                        break;
                    default:
                        continue;
                }
                var info = model.GetSymbolInfo(node);
                var symbols = info.Symbol is not null ? [info.Symbol] : info.CandidateSymbols;
                foreach (var s in symbols) Check(s, Add);
                if (model.GetTypeInfo(node).Type is { } t) Check(t, Add);
            }
        }
        return found.Count == 0 ? null : found.First().Value;
    }

    private static void Check(ISymbol symbol, Action<string, string> add)
    {
        if (symbol is IMethodSymbol { ReducedFrom: { } reduced }) symbol = reduced;
        if (symbol.Locations.Any(l => l.IsInSource)) return; // the learner's own code
        var type = symbol as INamedTypeSymbol ?? symbol.ContainingType;
        if (symbol is IArrayTypeSymbol arr) type = arr.ElementType as INamedTypeSymbol;
        if (type is null) return;
        if (type.IsGenericType) type = type.OriginalDefinition;
        var ns = type.ContainingNamespace?.ToDisplayString() ?? "";
        var display = symbol is INamedTypeSymbol ? type.ToDisplayString() : $"{type.Name}.{symbol.Name}";

        foreach (var (prefix, category) in NamespaceRules)
        {
            if (ns == prefix || ns.StartsWith(prefix + ".", StringComparison.Ordinal) || $"{ns}.{type.Name}" == prefix)
            {
                add(category, $"uses {display}");
                return;
            }
        }
        if (ns == "System.IO" && !InMemoryIo.Contains(type.Name)) add("filesystem", $"uses {display}");
        if (ns == "System" && type.Name == "Environment" && !PortableEnvironment.Contains(symbol.Name) && symbol is not INamedTypeSymbol) add("host", $"uses Environment.{symbol.Name}");
        if (ns == "System" && type.Name == "AppDomain") add("host", "uses AppDomain");
        // Console.ReadLine/Read/In are marked unsupported in the browser (there is no terminal), but the runner replaces
        // Console.In with the stdin box's text (Console.SetIn), so they work there.
        bool redirectedConsole = ns == "System" && type.Name == "Console" && symbol.Name is "ReadLine" or "Read" or "In" or "SetIn";
        if (!redirectedConsole && (UnsupportedInBrowser(symbol) || UnsupportedInBrowser(type))) add("browser-unsupported", $"uses {display}, which .NET does not support in the browser");
    }

    /// <summary>True when .NET marks the API <c>[UnsupportedOSPlatform("browser")]</c> (Console.ReadKey, console colours, …).</summary>
    public static bool UnsupportedInBrowser(ISymbol symbol)
    {
        for (var s = symbol; s is not null; s = s.ContainingSymbol)
        {
            if (s is INamespaceSymbol) break;
            foreach (var a in s.GetAttributes())
            {
                if (a.AttributeClass?.Name == "UnsupportedOSPlatformAttribute" && a.ConstructorArguments.FirstOrDefault().Value is string p && p.StartsWith("browser", StringComparison.OrdinalIgnoreCase)) return true;
            }
            if (s is IPropertySymbol prop)
            {
                // a setter or getter can be marked on its own (Console.ForegroundColor's setter)
                if (prop.SetMethod is { } set && UnsupportedInBrowserSelf(set)) return true;
                if (prop.GetMethod is { } get && UnsupportedInBrowserSelf(get)) return true;
            }
        }
        return false;
    }

    private static bool UnsupportedInBrowserSelf(ISymbol s) => s.GetAttributes().Any(a =>
        a.AttributeClass?.Name == "UnsupportedOSPlatformAttribute" && a.ConstructorArguments.FirstOrDefault().Value is string p && p.StartsWith("browser", StringComparison.OrdinalIgnoreCase));

    /// <summary>Does the program read standard input (so its output depends on what the learner types)?</summary>
    public static bool ReadsInput(CSharpCompilation compilation)
    {
        foreach (var tree in compilation.SyntaxTrees)
        {
            var model = compilation.GetSemanticModel(tree);
            foreach (var node in tree.GetRoot().DescendantNodes().OfType<MemberAccessExpressionSyntax>())
            {
                if (model.GetSymbolInfo(node).Symbol is { ContainingType: { Name: "Console", ContainingNamespace.Name: "System" } } s && s.Name is "ReadLine" or "Read" or "In" or "OpenStandardInput")
                    return true;
            }
        }
        return false;
    }

    /// <summary>Assemblies the compilation actually uses, by simple name.</summary>
    public static ImmutableArray<string> UsedAssemblies(CSharpCompilation compilation) =>
        [.. compilation.GetUsedAssemblyReferences().Select(r => compilation.GetAssemblyOrModuleSymbol(r) is IAssemblySymbol a ? a.Name : "?").Distinct().Order()];
}
