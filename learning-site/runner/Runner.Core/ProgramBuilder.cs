using System.Text;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace LearnYourself.Runner;

/// <summary>How a block from a note becomes a compilable console program.</summary>
public enum ProgramShape
{
    /// <summary>Top-level statements (optionally with local functions and types after them).</summary>
    TopLevel,
    /// <summary>Only type declarations, one of which has a <c>Main</c> method.</summary>
    EntryPoint,
    /// <summary>Only type declarations, no <c>Main</c>: the harness supplies top-level statements in harness.cs.</summary>
    TypesWithHarness,
    /// <summary>Only methods/fields/properties: wrapped in <c>partial class Snippet</c>; the harness becomes its entry point.</summary>
    MembersWithHarness,
    /// <summary>Declarations only and no harness: there is nothing to run.</summary>
    NothingToRun,
}

/// <summary>One source file of a built program. <see cref="Path"/> is what diagnostics and stack traces report.</summary>
public sealed record SourceDocument(string Path, string Text);

public sealed record BuiltProgram(ProgramShape Shape, IReadOnlyList<SourceDocument> Documents, string? Problem)
{
    public bool CanRun => Problem is null && Shape != ProgramShape.NothingToRun;
}

/// <summary>
/// Turns the learner's code (exactly as shown in the lesson or editor) plus an optional harness into source files.
/// The learner's text is never edited: anything added goes into separate files, or is fenced off with
/// <c>#line</c> directives, so compiler messages and stack traces always point at the learner's own lines.
/// </summary>
public static class ProgramBuilder
{
    public const string SnippetPath = "snippet.cs";
    public const string HarnessPath = "harness.cs";
    public const string UsingsPath = "usings.cs";
    /// <summary>Name of the class that wraps member-only blocks (methods, fields, properties).</summary>
    public const string WrapperClass = "Snippet";

    /// <summary>
    /// The SDK's implicit usings for a console app (<c>ImplicitUsings=enable</c>), minus System.Net.Http,
    /// which the browser runner does not reference (no network in the sandbox).
    /// </summary>
    public static readonly string[] ImplicitUsings =
    [
        "System",
        "System.Collections.Generic",
        "System.IO",
        "System.Linq",
        "System.Threading",
        "System.Threading.Tasks",
    ];

    public static readonly CSharpParseOptions ParseOptions = new(LanguageVersion.CSharp14, DocumentationMode.None, SourceCodeKind.Regular);

    public static string UsingsText { get; } = string.Concat(ImplicitUsings.Select(u => $"global using {u};\n"));

    /// <summary>What the block is made of, from its syntax tree.</summary>
    public sealed record Structure(bool Statements, bool Members, bool Types, bool MainMethod, int FirstTypeLine);

    public static Structure Analyze(string code)
    {
        var root = (CompilationUnitSyntax)CSharpSyntaxTree.ParseText(code, ParseOptions).GetRoot();
        bool statements = false, members = false, types = false, main = false;
        int firstTypeLine = -1;
        foreach (var m in root.Members)
        {
            switch (m)
            {
                case GlobalStatementSyntax { Statement: LocalFunctionStatementSyntax }:
                    members = true;
                    break;
                case GlobalStatementSyntax:
                    statements = true;
                    break;
                case BaseNamespaceDeclarationSyntax or BaseTypeDeclarationSyntax or DelegateDeclarationSyntax:
                    types = true;
                    if (firstTypeLine < 0) firstTypeLine = m.GetLocation().GetLineSpan().StartLinePosition.Line;
                    break;
                default:
                    // fields, properties, methods, events, incomplete members: class members written at top level
                    members = true;
                    break;
            }
        }
        foreach (var method in root.DescendantNodes().OfType<MethodDeclarationSyntax>())
        {
            if (method.Identifier.ValueText == "Main" && method.Modifiers.Any(SyntaxKind.StaticKeyword)) main = true;
        }
        return new Structure(statements, members, types, main, firstTypeLine);
    }

    /// <param name="code">The learner's code (one block, or several blocks joined for a merged program).</param>
    /// <param name="harness">Statements that call the code with the note's own sample input, or null.</param>
    public static BuiltProgram Build(string code, string? harness)
    {
        code = Normalize(code);
        harness = string.IsNullOrWhiteSpace(harness) ? null : Normalize(harness);
        var s = Analyze(code);
        var usings = new SourceDocument(UsingsPath, UsingsText);

        if (s.Statements)
        {
            if (harness is null) return new(ProgramShape.TopLevel, [usings, new(SnippetPath, code)], null);
            // A harness after top-level statements: insert it before the first type declaration (statements must
            // precede types), mapped to harness.cs so the snippet's own lines keep their numbers.
            var lines = SplitLines(code);
            int at = s.FirstTypeLine >= 0 ? s.FirstTypeLine : lines.Count;
            var sb = new StringBuilder();
            for (int i = 0; i < at; i++) sb.Append(lines[i]).Append('\n');
            sb.Append($"#line 1 \"{HarnessPath}\"\n").Append(harness).Append('\n');
            if (at < lines.Count)
            {
                sb.Append($"#line {at + 1} \"{SnippetPath}\"\n");
                for (int i = at; i < lines.Count; i++) sb.Append(lines[i]).Append('\n');
            }
            return new(ProgramShape.TopLevel, [usings, new(SnippetPath, sb.ToString())], null);
        }

        if (s.MainMethod && !s.Members)
        {
            // A complete program already; a harness would compete with its Main.
            return harness is null
                ? new(ProgramShape.EntryPoint, [usings, new(SnippetPath, code)], null)
                : new(ProgramShape.EntryPoint, [usings, new(SnippetPath, code)], "The block already has a Main method, so it needs no harness.");
        }

        if (s.Members)
        {
            // Methods/fields written at top level: wrap everything after the using directives in a class.
            // Without a harness this only runs if the block itself declares a static Main.
            if (harness is null && !s.MainMethod) return new(ProgramShape.NothingToRun, [usings, new(SnippetPath, code)], null);
            if (harness is not null && s.MainMethod) return new(ProgramShape.MembersWithHarness, [usings, new(SnippetPath, code)], "The block already has a Main method, so it needs no harness.");
            var wrapped = WrapMembers(code, harness is null ? null : $"partial class {WrapperClass}\n{{\n    static void Main() => new {WrapperClass}().RunHarness();\n    void RunHarness()\n    {{\n#line 1 \"{HarnessPath}\"\n{harness}\n#line default\n    }}\n}}\n");
            return new(ProgramShape.MembersWithHarness, [usings, .. wrapped], null);
        }

        if (s.Types && harness is not null)
        {
            return new(ProgramShape.TypesWithHarness, [usings, new(SnippetPath, code), new(HarnessPath, harness + "\n")], null);
        }

        return new(ProgramShape.NothingToRun, [usings, new(SnippetPath, code)], null);
    }

    /// <summary>
    /// <c>using</c> lines stay at the top of the file; the rest goes inside <c>partial class Snippet { … }</c>.
    /// The opening line is followed by a <c>#line</c> directive, so every learner line keeps its number.
    /// </summary>
    private static IEnumerable<SourceDocument> WrapMembers(string code, string? harnessFile)
    {
        var root = (CompilationUnitSyntax)CSharpSyntaxTree.ParseText(code, ParseOptions).GetRoot();
        var lines = SplitLines(code);
        int bodyStart = 0;
        if (root.Usings.Count > 0) bodyStart = root.Usings.Last().GetLocation().GetLineSpan().EndLinePosition.Line + 1;
        var sb = new StringBuilder();
        for (int i = 0; i < bodyStart; i++) sb.Append(lines[i]).Append('\n');
        sb.Append($"partial class {WrapperClass} {{\n#line {bodyStart + 1} \"{SnippetPath}\"\n");
        for (int i = bodyStart; i < lines.Count; i++) sb.Append(lines[i]).Append('\n');
        sb.Append("#line hidden\n}\n");
        yield return new SourceDocument(SnippetPath, sb.ToString());
        if (harnessFile is not null) yield return new SourceDocument(HarnessPath, harnessFile);
    }

    public static string Normalize(string text) => text.Replace("\r\n", "\n").Replace('\r', '\n');

    private static List<string> SplitLines(string text)
    {
        var lines = text.Split('\n').ToList();
        if (lines.Count > 1 && lines[^1].Length == 0) lines.RemoveAt(lines.Count - 1);
        return lines;
    }
}
