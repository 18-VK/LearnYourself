using System.Text;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.Text;

namespace LearnYourself.Runner.Debugger;

/// <summary>A variable a site records: its name and declared type (shown when the value is null).</summary>
public sealed record SiteVariable(string Name, string Type);

/// <summary>
/// A place in the learner's code the recorder reports: a method (or lambda, local function, accessor) for
/// <c>Enter</c>/<c>Exit</c>, or a statement (or loop condition, or return value) for <c>Step</c>/<c>Ret</c>.
/// Lines are the learner's (after <c>#line</c> mapping), 1-based; <see cref="File"/> is 0 for snippet.cs and 1 for harness.cs.
/// </summary>
public sealed class TraceSite
{
    public required int Id { get; init; }
    public required bool IsMethod { get; init; }
    public required int File { get; init; }
    public required int Line { get; init; }
    /// <summary>Methods: the line of the closing brace (a void method's "return" step).</summary>
    public int EndLine { get; init; }
    /// <summary>Methods: the frame name shown in the call stack.</summary>
    public string? Name { get; init; }
    /// <summary>Methods: the program's entry (Main, top-level statements, the harness); no "call" step is shown for it.</summary>
    public bool Entry { get; init; }
    public IReadOnlyList<SiteVariable> Variables { get; init; } = [];
    /// <summary>Methods: for each array or list, the int variables used to index it (for the array visualization).</summary>
    public IReadOnlyDictionary<string, IReadOnlyList<string>>? IndexHints { get; init; }
}

/// <summary>
/// The tracing debugger's instrumenter: a Roslyn syntax rewriter that adds calls to the recorder
/// (<c>Recorder.cs.txt</c>, added to the program as one more file) before compiling. See runner/NOTES.md, "Debugger".
///
/// What it adds, for every method, constructor, accessor, operator, local function and block lambda:
///   <c>{ int f = Enter(site, params); try { BODY } catch (Exception e) when (Thrown(e, f, 1)) { throw; } finally { Exit(f); } }</c>
/// and before every statement <c>Step(site, f, new object[] { locals… })</c> with the locals and parameters that are in
/// scope and definitely assigned there (Roslyn's data-flow analysis), so the inserted reads always compile.
///
/// Level 2 also records loop conditions (<c>while (Cond(…) &amp;&amp; (cond))</c>), return values
/// (<c>return Ret&lt;T&gt;(…, expr)</c>) and exceptions caught inside a method (a first <c>catch … when (Thrown(…))</c>);
/// level 1 only steps, calls and escaping exceptions; level 0 steps without variables. The caller tries 2, then 1, then 0,
/// and uses the first that compiles.
///
/// The learner's lines never move: inserted code contains no line breaks, and each statement's leading trivia
/// (indentation, comments, <c>#line</c> directives) moves onto the code inserted before it.
/// </summary>
public sealed class Instrumenter
{
    public const string RecorderType = "global::LyDebug.Recorder";
    private readonly ProgramShape _shape;
    private readonly List<TraceSite> _sites = [];

    public Instrumenter(ProgramShape shape, int level)
    {
        _shape = shape;
        Level = level;
    }

    public int Level { get; }
    public IReadOnlyList<TraceSite> Sites => _sites;

    private static string? _recorderSource;

    /// <summary>The recorder's source (embedded in Runner.Core as a resource; not compiled into it).</summary>
    public static string RecorderSource
    {
        get
        {
            if (_recorderSource is not null) return _recorderSource;
            using var s = typeof(Instrumenter).Assembly.GetManifestResourceStream("LyDebug.Recorder.cs")
                ?? throw new InvalidOperationException("The debugger's recorder source is missing from Runner.Core.");
            using var r = new StreamReader(s, Encoding.UTF8);
            return _recorderSource = r.ReadToEnd();
        }
    }

    public static SyntaxTree RecorderTree() =>
        CSharpSyntaxTree.ParseText(SourceText.From(RecorderSource, Encoding.UTF8), ProgramBuilder.ParseOptions, path: "");

    /// <summary>A <see cref="CompilationTransform"/>: rewrites snippet.cs and harness.cs and adds the recorder.</summary>
    public CSharpCompilation Transform(CSharpCompilation compilation)
    {
        var replaced = new List<(SyntaxTree Old, SyntaxTree New)>();
        foreach (var tree in compilation.SyntaxTrees)
        {
            var path = SnippetCompiler.DocumentPath(tree);
            if (path != ProgramBuilder.SnippetPath && path != ProgramBuilder.HarnessPath) continue;
            var model = compilation.GetSemanticModel(tree);
            var root = tree.GetRoot();
            var rewritten = new Rewriter(this, model, path).Visit(root);
            var newTree = tree.WithRootAndOptions(rewritten, tree.Options);
            // the learner's line numbers must not move (stack traces, breakpoints and the editor depend on it)
            if (newTree.GetText().Lines.Count != tree.GetText().Lines.Count)
                throw new InvalidOperationException($"The instrumenter changed the number of lines in {path}.");
            replaced.Add((tree, newTree));
        }
        foreach (var (o, n) in replaced) compilation = compilation.ReplaceSyntaxTree(o, n);
        return compilation.AddSyntaxTrees(RecorderTree());
    }

    private int AddSite(TraceSite site)
    {
        _sites.Add(site);
        return site.Id;
    }

    private int NextId => _sites.Count;

    /// <summary>Everything the rewriter knows about the function whose body it is inside.</summary>
    private sealed class Fn
    {
        public required IMethodSymbol Symbol { get; init; }
        public required string FrameVar { get; init; }
        public required int Site { get; init; }
        public bool Iterator { get; init; }
        /// <summary>Fully qualified return type for Ret, or null when return values aren't recorded here.</summary>
        public string? ReturnType { get; init; }
        /// <summary>Extra values every step records: `this`, or the wrapper class's fields.</summary>
        public required IReadOnlyList<(string Name, string Type, string Expression)> Extra { get; init; }
    }

    private sealed class Rewriter(Instrumenter owner, SemanticModel model, string path) : CSharpSyntaxRewriter
    {
        private readonly int _file = path == ProgramBuilder.HarnessPath ? 1 : 0;
        private readonly SyntaxTree _tree = model.SyntaxTree;
        private readonly Stack<Fn?> _fns = new();
        private int _counter;
        private int Level => owner.Level;
        private Fn? Current => _fns.Count > 0 ? _fns.Peek() : null;

        // ── functions ──────────────────────────────────────────────────────────────────────────

        public override SyntaxNode? VisitCompilationUnit(CompilationUnitSyntax node)
        {
            var globals = node.Members.OfType<GlobalStatementSyntax>().ToList();
            if (globals.Count == 0) return base.VisitCompilationUnit(node);
            var entry = model.GetEnclosingSymbol(globals[0].Statement.SpanStart) as IMethodSymbol;
            Fn? fn = null;
            if (entry is not null && !IsHidden(globals[0].Statement))
            {
                var statements = globals.Select(g => g.Statement).ToList();
                var name = _shape == ProgramShape.TypesWithHarness ? "harness" : "top-level statements";
                fn = NewFunction(entry, name, entry: true, Line(statements[0]), Line(statements[^1].GetLastToken()), [], statements, isIterator: false, returnType: null);
            }
            _fns.Push(fn);
            var body = InstrumentList(globals.Select(g => g.Statement));
            _fns.Pop();
            var members = new List<MemberDeclarationSyntax>();
            bool placed = false;
            foreach (var m in node.Members)
            {
                if (m is GlobalStatementSyntax)
                {
                    if (placed) continue;
                    placed = true;
                    if (fn is null)
                    {
                        members.AddRange(body.Select(s => SyntaxFactory.GlobalStatement(s)));
                        continue;
                    }
                    var leading = body[0].GetLeadingTrivia();
                    var trailing = body[^1].GetTrailingTrivia();
                    body[0] = body[0].WithLeadingTrivia(SyntaxTriviaList.Empty);
                    body[^1] = body[^1].WithTrailingTrivia(SyntaxTriviaList.Empty);
                    var block = SyntaxFactory.Block(
                        SyntaxFactory.Token(SyntaxKind.OpenBraceToken).WithLeadingTrivia(leading),
                        SyntaxFactory.List(body),
                        SyntaxFactory.Token(SyntaxKind.CloseBraceToken));
                    var wrapped = WrapBody(fn, block).WithTrailingTrivia(trailing);
                    members.Add(SyntaxFactory.GlobalStatement(wrapped));
                }
                else members.Add((MemberDeclarationSyntax)Visit(m)!);
            }
            // (using directives and attributes hold nothing to instrument)
            return node.WithMembers(SyntaxFactory.List(members));
        }

        private ProgramShape _shape => owner._shape;

        public override SyntaxNode? VisitMethodDeclaration(MethodDeclarationSyntax node)
        {
            var symbol = model.GetDeclaredSymbol(node);
            if (symbol is null || (node.Body is null && node.ExpressionBody is null) || IsGeneratedHarnessMain(node, symbol) || IsHidden(node))
                return Skip(node, () => base.VisitMethodDeclaration(node));
            bool entry = IsEntry(symbol) || IsHarnessBody(node, symbol);
            var name = entry ? EntryName(node, symbol) : MemberName(symbol, node.Identifier.ValueText);
            return VisitFunction(node, symbol, name, entry, node.Identifier, node.Body, node.ExpressionBody,
                n => base.VisitMethodDeclaration((MethodDeclarationSyntax)n),
                (n, body) => ((MethodDeclarationSyntax)n).WithExpressionBody(null).WithSemicolonToken(default).WithBody(body));
        }

        public override SyntaxNode? VisitConstructorDeclaration(ConstructorDeclarationSyntax node)
        {
            var symbol = model.GetDeclaredSymbol(node);
            if (symbol is null || (node.Body is null && node.ExpressionBody is null) || IsHidden(node)) return Skip(node, () => base.VisitConstructorDeclaration(node));
            var type = symbol.ContainingType.Name;
            var name = symbol.IsStatic ? $"static {type}" : $"new {type}";
            return VisitFunction(node, symbol, name, false, node.Identifier, node.Body, node.ExpressionBody,
                n => base.VisitConstructorDeclaration((ConstructorDeclarationSyntax)n),
                (n, body) => ((ConstructorDeclarationSyntax)n).WithExpressionBody(null).WithSemicolonToken(default).WithBody(body));
        }

        public override SyntaxNode? VisitDestructorDeclaration(DestructorDeclarationSyntax node) =>
            // finalizers run on the garbage collector's schedule (and thread): never traced
            Skip(node, () => base.VisitDestructorDeclaration(node));

        public override SyntaxNode? VisitOperatorDeclaration(OperatorDeclarationSyntax node)
        {
            var symbol = model.GetDeclaredSymbol(node);
            if (symbol is null || (node.Body is null && node.ExpressionBody is null) || IsHidden(node)) return Skip(node, () => base.VisitOperatorDeclaration(node));
            return VisitFunction(node, symbol, $"{symbol.ContainingType.Name}.operator {node.OperatorToken.ValueText}", false, node.OperatorToken, node.Body, node.ExpressionBody,
                n => base.VisitOperatorDeclaration((OperatorDeclarationSyntax)n),
                (n, body) => ((OperatorDeclarationSyntax)n).WithExpressionBody(null).WithSemicolonToken(default).WithBody(body));
        }

        public override SyntaxNode? VisitConversionOperatorDeclaration(ConversionOperatorDeclarationSyntax node)
        {
            var symbol = model.GetDeclaredSymbol(node);
            if (symbol is null || (node.Body is null && node.ExpressionBody is null) || IsHidden(node)) return Skip(node, () => base.VisitConversionOperatorDeclaration(node));
            return VisitFunction(node, symbol, $"{symbol.ContainingType.Name}.operator {node.ImplicitOrExplicitKeyword.ValueText}", false, node.OperatorKeyword, node.Body, node.ExpressionBody,
                n => base.VisitConversionOperatorDeclaration((ConversionOperatorDeclarationSyntax)n),
                (n, body) => ((ConversionOperatorDeclarationSyntax)n).WithExpressionBody(null).WithSemicolonToken(default).WithBody(body));
        }

        public override SyntaxNode? VisitAccessorDeclaration(AccessorDeclarationSyntax node)
        {
            var symbol = model.GetDeclaredSymbol(node);
            bool supported = node.Kind() is SyntaxKind.GetAccessorDeclaration or SyntaxKind.SetAccessorDeclaration or SyntaxKind.InitAccessorDeclaration;
            if (symbol is null || !supported || (node.Body is null && node.ExpressionBody is null) || IsHidden(node)) return Skip(node, () => base.VisitAccessorDeclaration(node));
            var name = $"{AccessorOwner(symbol)} ({node.Keyword.ValueText})";
            return VisitFunction(node, symbol, name, false, node.Keyword, node.Body, node.ExpressionBody,
                n => base.VisitAccessorDeclaration((AccessorDeclarationSyntax)n),
                (n, body) => ((AccessorDeclarationSyntax)n).WithExpressionBody(null).WithSemicolonToken(default).WithBody(body));
        }

        public override SyntaxNode? VisitPropertyDeclaration(PropertyDeclarationSyntax node)
        {
            if (node.ExpressionBody is null) return base.VisitPropertyDeclaration(node);
            var symbol = model.GetDeclaredSymbol(node)?.GetMethod;
            if (symbol is null || IsHidden(node)) return Skip(node, () => base.VisitPropertyDeclaration(node));
            // `int Area => W * H;` becomes `int Area { get { … } }`
            return VisitFunction(node, symbol, $"{AccessorOwner(symbol)} (get)", false, node.Identifier, null, node.ExpressionBody,
                n => base.VisitPropertyDeclaration((PropertyDeclarationSyntax)n),
                (n, body) => GetterOnly((PropertyDeclarationSyntax)n, body));
        }

        public override SyntaxNode? VisitIndexerDeclaration(IndexerDeclarationSyntax node)
        {
            if (node.ExpressionBody is null) return base.VisitIndexerDeclaration(node);
            var symbol = model.GetDeclaredSymbol(node)?.GetMethod;
            if (symbol is null || IsHidden(node)) return Skip(node, () => base.VisitIndexerDeclaration(node));
            return VisitFunction(node, symbol, $"{AccessorOwner(symbol)} (get)", false, node.ThisKeyword, null, node.ExpressionBody,
                n => base.VisitIndexerDeclaration((IndexerDeclarationSyntax)n),
                (n, body) => GetterOnly((IndexerDeclarationSyntax)n, body));
        }

        public override SyntaxNode? VisitEventDeclaration(EventDeclarationSyntax node) => Skip(node, () => base.VisitEventDeclaration(node));

        public override SyntaxNode? VisitLocalFunctionStatement(LocalFunctionStatementSyntax node)
        {
            var symbol = model.GetDeclaredSymbol(node) as IMethodSymbol;
            if (symbol is null || (node.Body is null && node.ExpressionBody is null) || IsHidden(node)) return Skip(node, () => base.VisitLocalFunctionStatement(node));
            return VisitFunction(node, symbol, node.Identifier.ValueText, false, node.Identifier, node.Body, node.ExpressionBody,
                n => base.VisitLocalFunctionStatement((LocalFunctionStatementSyntax)n),
                (n, body) => ((LocalFunctionStatementSyntax)n).WithExpressionBody(null).WithSemicolonToken(default).WithBody(body));
        }

        public override SyntaxNode? VisitParenthesizedLambdaExpression(ParenthesizedLambdaExpressionSyntax node) =>
            VisitLambda(node, node.Block, n => base.VisitParenthesizedLambdaExpression((ParenthesizedLambdaExpressionSyntax)n), (n, b) => ((ParenthesizedLambdaExpressionSyntax)n).WithBlock(b));

        public override SyntaxNode? VisitSimpleLambdaExpression(SimpleLambdaExpressionSyntax node) =>
            VisitLambda(node, node.Block, n => base.VisitSimpleLambdaExpression((SimpleLambdaExpressionSyntax)n), (n, b) => ((SimpleLambdaExpressionSyntax)n).WithBlock(b));

        public override SyntaxNode? VisitAnonymousMethodExpression(AnonymousMethodExpressionSyntax node) =>
            VisitLambda(node, node.Block, n => base.VisitAnonymousMethodExpression((AnonymousMethodExpressionSyntax)n), (n, b) => ((AnonymousMethodExpressionSyntax)n).WithBlock(b));

        private SyntaxNode? VisitLambda(AnonymousFunctionExpressionSyntax node, BlockSyntax? block, Func<SyntaxNode, SyntaxNode?> visitChildren, Func<SyntaxNode, BlockSyntax, SyntaxNode> withBlock)
        {
            // expression lambdas (x => x * 2) are left alone: they have no statements, and a block body could change
            // how an overload or an expression tree is chosen
            if (block is null || model.GetSymbolInfo(node).Symbol is not IMethodSymbol symbol || IsHidden(node)) return Skip(node, () => visitChildren(node), keepContext: block is null);
            return VisitFunction(node, symbol, "lambda", false, node.GetFirstToken(), block, null, visitChildren, (n, b) => withBlock(n, b), isLambda: true);
        }

        /// <summary>Visits a function's children with its context pushed, then wraps its (block or expression) body.</summary>
        private SyntaxNode VisitFunction(SyntaxNode node, IMethodSymbol symbol, string name, bool entry, SyntaxToken nameToken, BlockSyntax? body, ArrowExpressionClauseSyntax? expressionBody,
            Func<SyntaxNode, SyntaxNode?> visitChildren, Func<SyntaxNode, BlockSyntax, SyntaxNode> withBody, bool isLambda = false)
        {
            bool iterator = symbol.IsIterator;
            string? returnType = null;
            if (Level >= 2 && !entry && !isLambda && !symbol.IsAsync && !iterator && !symbol.ReturnsVoid && !symbol.ReturnsByRef && !symbol.ReturnsByRefReadonly && Recordable(symbol.ReturnType))
                returnType = symbol.ReturnType.ToDisplayString(SymbolDisplayFormat.FullyQualifiedFormat);
            int endLine = body is not null ? Line(body.CloseBraceToken) : expressionBody is not null ? Line(expressionBody.Expression.GetLastToken()) : Line(nameToken);
            List<ISymbol> parameters = entry ? [] : [.. symbol.Parameters.Where(p => p.RefKind != RefKind.Out && !p.IsDiscard && Recordable(p.Type))];
            IEnumerable<SyntaxNode> bodyNodes = body is not null ? body.Statements : expressionBody is not null ? [expressionBody.Expression] : [];
            var fn = NewFunction(symbol, name, entry, Line(nameToken), endLine, parameters, bodyNodes, iterator, returnType, isLambda);
            _fns.Push(fn);
            var visited = visitChildren(node)!;
            _fns.Pop();
            BlockSyntax newBody;
            if (body is not null)
            {
                var visitedBody = visited switch
                {
                    BaseMethodDeclarationSyntax m => m.Body,
                    AccessorDeclarationSyntax a => a.Body,
                    LocalFunctionStatementSyntax l => l.Body,
                    AnonymousFunctionExpressionSyntax f => f.Block,
                    _ => null,
                } ?? throw new InvalidOperationException("function body went missing");
                newBody = WrapBody(fn, visitedBody);
            }
            else
            {
                var visitedArrow = visited switch
                {
                    BaseMethodDeclarationSyntax m => m.ExpressionBody,
                    AccessorDeclarationSyntax a => a.ExpressionBody,
                    LocalFunctionStatementSyntax l => l.ExpressionBody,
                    BasePropertyDeclarationSyntax p => p is PropertyDeclarationSyntax pd ? pd.ExpressionBody : ((IndexerDeclarationSyntax)p).ExpressionBody,
                    _ => null,
                } ?? throw new InvalidOperationException("expression body went missing");
                var semicolon = visited switch
                {
                    BaseMethodDeclarationSyntax m => m.SemicolonToken,
                    AccessorDeclarationSyntax a => a.SemicolonToken,
                    LocalFunctionStatementSyntax l => l.SemicolonToken,
                    PropertyDeclarationSyntax p => p.SemicolonToken,
                    IndexerDeclarationSyntax i => i.SemicolonToken,
                    _ => default,
                };
                newBody = WrapBody(fn, ExpressionToBlock(fn, expressionBody!, visitedArrow, semicolon, symbol));
            }
            return withBody(visited, newBody);
        }

        private Fn NewFunction(IMethodSymbol symbol, string name, bool entry, int line, int endLine, IReadOnlyList<ISymbol> parameters,
            IEnumerable<SyntaxNode> bodyNodes, bool isIterator, string? returnType, bool isLambda = false)
        {
            IReadOnlyList<(string Name, string Type, string Expression)> extra = isLambda ? [] : ExtraValues(symbol);
            var variables = new List<SiteVariable>();
            variables.AddRange(extra.Select(e => new SiteVariable(e.Name, e.Type)));
            variables.AddRange(parameters.Select(p => new SiteVariable(p.Name, TypeText(((IParameterSymbol)p).Type))));
            var site = owner.AddSite(new TraceSite
            {
                Id = owner.NextId,
                IsMethod = true,
                File = _file,
                Line = line,
                EndLine = endLine,
                Name = name,
                Entry = entry,
                Variables = Level == 0 ? [] : variables,
                IndexHints = Level == 0 ? null : IndexHints(bodyNodes),
            });
            _enterArgs[site] = Level == 0 ? "null" : ValuesArray([.. extra.Select(e => e.Expression), .. parameters.Select(p => Escape(p.Name))]);
            return new Fn
            {
                Symbol = symbol,
                FrameVar = $"__ly_f{_counter++}",
                Site = site,
                Iterator = isIterator,
                ReturnType = returnType,
                Extra = extra,
            };
        }

        private readonly Dictionary<int, string> _enterArgs = [];

        /// <summary>
        /// <c>{ int f = Enter(…); try { BODY } catch (Exception e) when (Thrown(e, f, 1)) { throw; } finally { Exit(f); } }</c>,
        /// laid out so no line break is added: the inserted code sits on the lines of the original braces.
        /// </summary>
        private BlockSyntax WrapBody(Fn fn, BlockSyntax body)
        {
            var f = fn.FrameVar;
            var enter = SyntaxFactory.ParseStatement($"int {f} = {RecorderType}.Enter({fn.Site}, {_enterArgs[fn.Site]});");
            var inner = body.WithOpenBraceToken(SyntaxFactory.Token(SyntaxKind.OpenBraceToken).WithTrailingTrivia(body.OpenBraceToken.TrailingTrivia))
                .WithCloseBraceToken(SyntaxFactory.Token(SyntaxKind.CloseBraceToken).WithLeadingTrivia(body.CloseBraceToken.LeadingTrivia));
            var e = $"__ly_e{_counter++}";
            var catches = fn.Iterator
                ? default // `yield return` can't be inside a try block that has a catch clause
                : SyntaxFactory.SingletonList((CatchClauseSyntax)((TryStatementSyntax)SyntaxFactory.ParseStatement($"try {{ }} catch (global::System.Exception {e}) when ({RecorderType}.Thrown({e}, {f}, 1)) {{ throw; }}")).Catches[0]);
            var fin = SyntaxFactory.FinallyClause(SyntaxFactory.Block(SyntaxFactory.ParseStatement($"{RecorderType}.Exit({f});")));
            var tryStatement = SyntaxFactory.TryStatement(inner, catches, fin);
            return SyntaxFactory.Block(
                SyntaxFactory.Token(SyntaxKind.OpenBraceToken).WithLeadingTrivia(body.OpenBraceToken.LeadingTrivia),
                SyntaxFactory.List<StatementSyntax>([enter, tryStatement]),
                SyntaxFactory.Token(SyntaxKind.CloseBraceToken).WithTrailingTrivia(body.CloseBraceToken.TrailingTrivia));
        }

        /// <summary><c>=> expr;</c> becomes <c>{ Step(…); return expr; }</c> (or <c>{ Step(…); expr; }</c> for void members).</summary>
        private BlockSyntax ExpressionToBlock(Fn fn, ArrowExpressionClauseSyntax original, ArrowExpressionClauseSyntax visited, SyntaxToken semicolon, IMethodSymbol symbol)
        {
            var expr = visited.Expression;
            // keep every line break: the arrow's trailing trivia goes in front of the expression
            expr = expr.WithLeadingTrivia(visited.ArrowToken.TrailingTrivia.AddRange(expr.GetLeadingTrivia()));
            var trailing = expr.GetTrailingTrivia().AddRange(semicolon.LeadingTrivia);
            expr = expr.WithTrailingTrivia(SyntaxTriviaList.Empty);
            var statements = new List<StatementSyntax>();
            var step = StepFor(original.Expression, Line(original.Expression));
            if (step is not null) statements.Add(step);
            bool isVoid = symbol.ReturnsVoid || symbol.MethodKind is MethodKind.Constructor or MethodKind.StaticConstructor || (symbol.IsAsync && symbol.ReturnType is INamedTypeSymbol { IsGenericType: false });
            if (expr is ThrowExpressionSyntax th)
                statements.Add(SyntaxFactory.ThrowStatement(th.Expression.WithLeadingTrivia(SyntaxFactory.Space)).WithLeadingTrivia(expr.GetLeadingTrivia()));
            else if (isVoid)
                statements.Add(SyntaxFactory.ExpressionStatement(expr));
            else
            {
                var value = fn.ReturnType is not null && expr is not RefExpressionSyntax ? WrapReturn(fn, Line(original.Expression), expr.WithoutLeadingTrivia()).WithLeadingTrivia(expr.GetLeadingTrivia()) : expr;
                statements.Add(SyntaxFactory.ReturnStatement(SyntaxFactory.Token(SyntaxKind.ReturnKeyword).WithTrailingTrivia(SyntaxFactory.Space), value, SyntaxFactory.Token(SyntaxKind.SemicolonToken)));
            }
            return SyntaxFactory.Block(
                SyntaxFactory.Token(SyntaxKind.OpenBraceToken).WithLeadingTrivia(visited.ArrowToken.LeadingTrivia),
                SyntaxFactory.List(statements),
                SyntaxFactory.Token(SyntaxKind.CloseBraceToken).WithLeadingTrivia(trailing).WithTrailingTrivia(semicolon.TrailingTrivia));
        }

        private static PropertyDeclarationSyntax GetterOnly(PropertyDeclarationSyntax p, BlockSyntax body) =>
            p.WithExpressionBody(null).WithSemicolonToken(default).WithAccessorList(AccessorsFor(body));

        private static IndexerDeclarationSyntax GetterOnly(IndexerDeclarationSyntax p, BlockSyntax body) =>
            p.WithExpressionBody(null).WithSemicolonToken(default).WithAccessorList(AccessorsFor(body));

        private static AccessorListSyntax AccessorsFor(BlockSyntax body)
        {
            // `{ get BODY }`, with the body's outer trivia moved onto the accessor list's braces
            var inner = body.WithOpenBraceToken(body.OpenBraceToken.WithLeadingTrivia(SyntaxTriviaList.Empty)).WithCloseBraceToken(body.CloseBraceToken.WithTrailingTrivia(SyntaxTriviaList.Empty));
            var get = SyntaxFactory.AccessorDeclaration(SyntaxKind.GetAccessorDeclaration, inner);
            return SyntaxFactory.AccessorList(
                SyntaxFactory.Token(SyntaxKind.OpenBraceToken).WithLeadingTrivia(body.OpenBraceToken.LeadingTrivia),
                SyntaxFactory.SingletonList(get),
                SyntaxFactory.Token(SyntaxKind.CloseBraceToken).WithTrailingTrivia(body.CloseBraceToken.TrailingTrivia));
        }

        /// <summary>Visits a member that is not traced: statements inside it get no steps.</summary>
        private SyntaxNode? Skip(SyntaxNode node, Func<SyntaxNode?> visit, bool keepContext = false)
        {
            if (keepContext) return visit();
            _fns.Push(null);
            try
            {
                return visit();
            }
            finally
            {
                _fns.Pop();
            }
        }

        // ── statements ─────────────────────────────────────────────────────────────────────────

        public override SyntaxNode? VisitBlock(BlockSyntax node)
        {
            if (Current is null) return base.VisitBlock(node);
            return node.WithStatements(SyntaxFactory.List(InstrumentList(node.Statements)));
        }

        public override SyntaxNode? VisitSwitchSection(SwitchSectionSyntax node)
        {
            if (Current is null) return base.VisitSwitchSection(node);
            var labels = SyntaxFactory.List(node.Labels.Select(l => (SwitchLabelSyntax)Visit(l)!));
            return node.WithLabels(labels).WithStatements(SyntaxFactory.List(InstrumentList(node.Statements)));
        }

        /// <summary>A step before each statement of a list (block, switch section, top-level statements).</summary>
        private List<StatementSyntax> InstrumentList(IEnumerable<StatementSyntax> statements)
        {
            var list = new List<StatementSyntax>();
            foreach (var s in statements)
            {
                if (Current is null)
                {
                    list.Add((StatementSyntax)Visit(s)!);
                    continue;
                }
                if (s is LabeledStatementSyntax labeled && NeedsStep(labeled.Statement) && StepFor(labeled.Statement, Line(labeled.Statement)) is { } labeledStep)
                {
                    // `L: S` becomes `L: Step(…); S`, so a goto to L records the step too
                    var inner = (StatementSyntax)Visit(labeled.Statement)!;
                    list.Add(labeled.WithStatement(labeledStep.WithLeadingTrivia(inner.GetLeadingTrivia())));
                    list.Add(inner.WithLeadingTrivia(SyntaxTriviaList.Empty));
                    continue;
                }
                var visited = (StatementSyntax)Visit(s)!;
                if (NeedsStep(s) && StepFor(s, Line(s)) is { } step)
                {
                    list.Add(step.WithLeadingTrivia(visited.GetLeadingTrivia()));
                    list.Add(visited.WithLeadingTrivia(SyntaxTriviaList.Empty));
                }
                else list.Add(visited);
            }
            return list;
        }

        /// <summary>Statements that get a step of their own (loops with a per-iteration step don't need one more).</summary>
        private bool NeedsStep(StatementSyntax s) => s switch
        {
            BlockSyntax or EmptyStatementSyntax or LocalFunctionStatementSyntax or LabeledStatementSyntax => false,
            LocalDeclarationStatementSyntax { IsConst: true } => false,
            WhileStatementSyntax or ForStatementSyntax => false,
            _ => !IsHidden(s),
        };

        /// <summary>
        /// An embedded statement (the body of an if/else/loop/using): when it is not a block, it becomes
        /// <c>{ header; Step(…); S }</c>, so the step runs exactly when the statement does.
        /// </summary>
        private StatementSyntax Embedded(StatementSyntax original, StatementSyntax visited, StatementSyntax? header = null)
        {
            if (Current is null) return visited;
            if (original is BlockSyntax && visited is BlockSyntax block)
            {
                if (header is null) return block;
                var statements = block.Statements;
                if (statements.Count == 0) return block.WithStatements(SyntaxFactory.SingletonList(header));
                var first = statements[0];
                return block.WithStatements(statements.Replace(first, first.WithLeadingTrivia(SyntaxTriviaList.Empty)).Insert(0, header.WithLeadingTrivia(first.GetLeadingTrivia())));
            }
            var list = new List<StatementSyntax>();
            if (header is not null) list.Add(header);
            if (NeedsStep(original) && StepFor(original, Line(original)) is { } step) list.Add(step);
            if (list.Count == 0) return visited;
            list.Add(visited.WithoutLeadingTrivia().WithoutTrailingTrivia());
            return SyntaxFactory.Block(
                SyntaxFactory.Token(SyntaxKind.OpenBraceToken).WithLeadingTrivia(visited.GetLeadingTrivia()),
                SyntaxFactory.List(list),
                SyntaxFactory.Token(SyntaxKind.CloseBraceToken).WithTrailingTrivia(visited.GetTrailingTrivia()));
        }

        public override SyntaxNode? VisitIfStatement(IfStatementSyntax node)
        {
            var visited = (IfStatementSyntax)base.VisitIfStatement(node)!;
            return visited.WithStatement(Embedded(node.Statement, visited.Statement));
        }

        public override SyntaxNode? VisitElseClause(ElseClauseSyntax node)
        {
            var visited = (ElseClauseSyntax)base.VisitElseClause(node)!;
            return visited.WithStatement(Embedded(node.Statement, visited.Statement));
        }

        public override SyntaxNode? VisitWhileStatement(WhileStatementSyntax node)
        {
            var fn = Current;
            var visited = (WhileStatementSyntax)base.VisitWhileStatement(node)!;
            if (fn is null || IsHidden(node)) return visited;
            int line = Line(node);
            if (Level >= 2 && !IsConstant(node.Condition) && CondFor(node.Condition, line) is { } cond)
                return visited.WithCondition(Condition(cond, visited.Condition)).WithStatement(Embedded(node.Statement, visited.Statement));
            return visited.WithStatement(Embedded(node.Statement, visited.Statement, StepFor(node.Statement, line)));
        }

        public override SyntaxNode? VisitForStatement(ForStatementSyntax node)
        {
            var fn = Current;
            var visited = (ForStatementSyntax)base.VisitForStatement(node)!;
            if (fn is null || IsHidden(node)) return visited;
            int line = Line(node);
            if (Level >= 2 && node.Condition is not null && visited.Condition is not null && !IsConstant(node.Condition) && CondFor(node.Condition, line) is { } cond)
                return visited.WithCondition(Condition(cond, visited.Condition)).WithStatement(Embedded(node.Statement, visited.Statement));
            return visited.WithStatement(Embedded(node.Statement, visited.Statement, StepFor(node.Statement, line)));
        }

        public override SyntaxNode? VisitDoStatement(DoStatementSyntax node)
        {
            var fn = Current;
            var visited = (DoStatementSyntax)base.VisitDoStatement(node)!;
            if (fn is null || IsHidden(node)) return visited;
            int line = Line(node.WhileKeyword);
            if (Level >= 2 && !IsConstant(node.Condition) && CondFor(node.Condition, line) is { } cond)
                return visited.WithCondition(Condition(cond, visited.Condition)).WithStatement(Embedded(node.Statement, visited.Statement));
            // `do { } while (true);`: a step per iteration, so the step cap can stop it
            var header = IsConstant(node.Condition) ? StepFor(node.Statement, Line(node)) : null;
            return visited.WithStatement(Embedded(node.Statement, visited.Statement, header));
        }

        public override SyntaxNode? VisitForEachStatement(ForEachStatementSyntax node)
        {
            var visited = (ForEachStatementSyntax)base.VisitForEachStatement(node)!;
            if (Current is null || IsHidden(node)) return visited;
            // a step on the foreach line for each item, with the loop variable set
            return visited.WithStatement(Embedded(node.Statement, visited.Statement, StepFor(node.Statement, Line(node))));
        }

        public override SyntaxNode? VisitForEachVariableStatement(ForEachVariableStatementSyntax node)
        {
            var visited = (ForEachVariableStatementSyntax)base.VisitForEachVariableStatement(node)!;
            if (Current is null || IsHidden(node)) return visited;
            return visited.WithStatement(Embedded(node.Statement, visited.Statement, StepFor(node.Statement, Line(node))));
        }

        public override SyntaxNode? VisitUsingStatement(UsingStatementSyntax node)
        {
            var visited = (UsingStatementSyntax)base.VisitUsingStatement(node)!;
            return visited.WithStatement(Embedded(node.Statement, visited.Statement));
        }

        public override SyntaxNode? VisitLockStatement(LockStatementSyntax node)
        {
            var visited = (LockStatementSyntax)base.VisitLockStatement(node)!;
            return visited.WithStatement(Embedded(node.Statement, visited.Statement));
        }

        public override SyntaxNode? VisitFixedStatement(FixedStatementSyntax node)
        {
            var visited = (FixedStatementSyntax)base.VisitFixedStatement(node)!;
            return visited.WithStatement(Embedded(node.Statement, visited.Statement));
        }

        public override SyntaxNode? VisitReturnStatement(ReturnStatementSyntax node)
        {
            var fn = Current;
            var visited = (ReturnStatementSyntax)base.VisitReturnStatement(node)!;
            if (fn?.ReturnType is null || visited.Expression is null || visited.Expression is RefExpressionSyntax || IsHidden(node)) return visited;
            var expr = visited.Expression;
            return visited.WithExpression(WrapReturn(fn, Line(node), expr.WithoutTrivia()).WithTriviaFrom(expr));
        }

        public override SyntaxNode? VisitTryStatement(TryStatementSyntax node)
        {
            var fn = Current;
            var visited = (TryStatementSyntax)base.VisitTryStatement(node)!;
            if (fn is null || fn.Iterator || Level < 2 || IsHidden(node)) return visited;
            // a first catch clause whose filter records the exception and never catches it, so exceptions that the
            // learner's own catch handles are shown where they were thrown too
            var e = $"__ly_e{_counter++}";
            var clause = ((TryStatementSyntax)SyntaxFactory.ParseStatement($"try {{ }} catch (global::System.Exception {e}) when ({RecorderType}.Thrown({e}, {fn.FrameVar}, 0)) {{ throw; }}")).Catches[0];
            var block = visited.Block;
            clause = clause.WithTrailingTrivia(block.CloseBraceToken.TrailingTrivia);
            block = block.WithCloseBraceToken(block.CloseBraceToken.WithTrailingTrivia(SyntaxTriviaList.Empty));
            return visited.WithBlock(block).WithCatches(visited.Catches.Insert(0, clause));
        }

        // ── generated code ─────────────────────────────────────────────────────────────────────

        private ExpressionSyntax WrapReturn(Fn fn, int line, ExpressionSyntax expr)
        {
            var site = owner.AddSite(new TraceSite { Id = owner.NextId, IsMethod = false, File = _file, Line = line });
            var call = (InvocationExpressionSyntax)SyntaxFactory.ParseExpression($"{RecorderType}.Ret<{fn.ReturnType}>({site}, {fn.FrameVar}, default)");
            var args = call.ArgumentList.Arguments;
            return call.WithArgumentList(call.ArgumentList.WithArguments(args.Replace(args[2], args[2].WithExpression(expr))));
        }

        private static ExpressionSyntax Condition(ExpressionSyntax cond, ExpressionSyntax original) =>
            SyntaxFactory.BinaryExpression(SyntaxKind.LogicalAndExpression, cond, SyntaxFactory.Token(SyntaxKind.AmpersandAmpersandToken), SyntaxFactory.ParenthesizedExpression(original.WithoutTrivia()))
                .WithTriviaFrom(original);

        private StatementSyntax? StepFor(SyntaxNode node, int line)
        {
            var fn = Current;
            if (fn is null) return null;
            var (site, values) = Site(node, line);
            return SyntaxFactory.ParseStatement($"{RecorderType}.Step({site}, {fn.FrameVar}, {values});");
        }

        private ExpressionSyntax? CondFor(ExpressionSyntax condition, int line)
        {
            var fn = Current;
            if (fn is null) return null;
            var (site, values) = Site(condition, line);
            return SyntaxFactory.ParseExpression($"{RecorderType}.Cond({site}, {fn.FrameVar}, {values})");
        }

        /// <summary>A statement site and the `new object[] { … }` of the variables visible and assigned at <paramref name="node"/>.</summary>
        private (int Site, string Values) Site(SyntaxNode node, int line)
        {
            var fn = Current!;
            var vars = new List<(string Name, string Type, string Expression)>();
            if (Level > 0)
            {
                vars.AddRange(fn.Extra);
                foreach (var v in VisibleVariables(fn, node)) vars.Add((v.Name, TypeText(v is ILocalSymbol l ? l.Type : ((IParameterSymbol)v).Type), Escape(v.Name)));
            }
            var site = owner.AddSite(new TraceSite
            {
                Id = owner.NextId,
                IsMethod = false,
                File = _file,
                Line = line,
                Variables = [.. vars.Select(v => new SiteVariable(v.Name, v.Type))],
            });
            return (site, ValuesArray([.. vars.Select(v => v.Expression)]));
        }

        private static string ValuesArray(IReadOnlyList<string> expressions) =>
            expressions.Count == 0 ? "null" : $"new object[] {{ {string.Join(", ", expressions)} }}";

        /// <summary>
        /// The function's own parameters and locals that are in scope at <paramref name="node"/> and definitely assigned
        /// on entry to it (reading anything else would not compile), in declaration order.
        /// </summary>
        private List<ISymbol> VisibleVariables(Fn fn, SyntaxNode node)
        {
            HashSet<ISymbol> assigned;
            System.Collections.Immutable.ImmutableArray<ISymbol> onEntry;
            try
            {
                var flow = node is ExpressionSyntax e ? model.AnalyzeDataFlow(e) : node is StatementSyntax s ? model.AnalyzeDataFlow(s) : null;
                if (flow is null || !flow.Succeeded) return Parameters(fn, null);
                onEntry = flow.DefinitelyAssignedOnEntry;
                assigned = new HashSet<ISymbol>(onEntry, SymbolEqualityComparer.Default);
            }
            catch (ArgumentException)
            {
                return Parameters(fn, null);
            }
            var result = Parameters(fn, assigned);
            int position = node.SpanStart;
            var locals = onEntry.OfType<ILocalSymbol>()
                .Where(l => SymbolEqualityComparer.Default.Equals(l.ContainingSymbol, fn.Symbol) && Recordable(l.Type))
                .Select(l => (Local: l, At: l.Locations.FirstOrDefault(x => x.IsInSource)?.SourceSpan.Start ?? int.MaxValue))
                // declared before this point (in unreachable code everything counts as assigned, even later locals)
                .Where(x => x.At < position)
                .OrderBy(x => x.At);
            foreach (var (local, _) in locals)
            {
                // in scope here, and not hidden by something else with the same name
                var found = model.LookupSymbols(position, name: local.Name);
                if (found.Length == 1 && SymbolEqualityComparer.Default.Equals(found[0], local)) result.Add(local);
            }
            return result;
        }

        private List<ISymbol> Parameters(Fn fn, HashSet<ISymbol>? assigned)
        {
            var list = new List<ISymbol>();
            if (owner._sites[fn.Site].Entry) return list; // Main(string[] args): args is never interesting
            foreach (var p in fn.Symbol.Parameters)
            {
                if (!Recordable(p.Type) || p.IsDiscard) continue;
                if (p.RefKind == RefKind.Out && (assigned is null || !assigned.Contains(p))) continue;
                list.Add(p);
            }
            return list;
        }

        /// <summary>
        /// Values every step of a member records besides its locals: <c>this</c> for an instance member of a class with
        /// fields, or, in the class that wraps a block of bare methods, that block's own fields by name.
        /// </summary>
        private IReadOnlyList<(string Name, string Type, string Expression)> ExtraValues(IMethodSymbol symbol)
        {
            var type = symbol.ContainingType;
            if (type is null || symbol.MethodKind is MethodKind.LocalFunction or MethodKind.AnonymousFunction) return [];
            if (type.Name == ProgramBuilder.WrapperClass && _shape == ProgramShape.MembersWithHarness)
            {
                var list = new List<(string, string, string)>();
                foreach (var f in type.GetMembers().OfType<IFieldSymbol>())
                {
                    if (f.IsImplicitlyDeclared || f.IsConst || !Recordable(f.Type) || (!f.IsStatic && symbol.IsStatic)) continue;
                    var access = f.IsStatic ? $"global::{ProgramBuilder.WrapperClass}.{Escape(f.Name)}" : $"this.{Escape(f.Name)}";
                    list.Add((f.Name, TypeText(f.Type), access));
                }
                return list;
            }
            if (symbol.IsStatic || type.TypeKind != TypeKind.Class) return [];
            for (var t = type; t is not null && t.Locations.Any(l => l.IsInSource); t = t.BaseType)
            {
                if (t.GetMembers().Any(m => m is IFieldSymbol { IsStatic: false, IsConst: false } or IPropertySymbol { IsStatic: false, IsIndexer: false }))
                    return [("this", TypeText(type), "this")];
            }
            return [];
        }

        /// <summary>For each array or list variable, the int variables used inside its brackets (<c>arr[j + 1]</c> → j).</summary>
        private IReadOnlyDictionary<string, IReadOnlyList<string>>? IndexHints(IEnumerable<SyntaxNode> body)
        {
            var hints = new Dictionary<string, List<string>>();
            foreach (var root in body)
            {
                foreach (var access in root.DescendantNodesAndSelf().OfType<ElementAccessExpressionSyntax>())
                {
                    if (access.Expression is not IdentifierNameSyntax target) continue;
                    var symbol = model.GetSymbolInfo(target).Symbol;
                    var type = symbol switch { ILocalSymbol l => l.Type, IParameterSymbol p => p.Type, IFieldSymbol f => f.Type, _ => null };
                    if (type is null || !(type is IArrayTypeSymbol { Rank: 1 } || type.Name is "List" or "IList")) continue;
                    foreach (var id in access.ArgumentList.DescendantNodes().OfType<IdentifierNameSyntax>())
                    {
                        var s = model.GetSymbolInfo(id).Symbol;
                        var t = s switch { ILocalSymbol l => l.Type, IParameterSymbol p => p.Type, IFieldSymbol f => f.Type, _ => null };
                        if (t?.SpecialType != SpecialType.System_Int32) continue;
                        var list = hints.TryGetValue(target.Identifier.ValueText, out var l2) ? l2 : hints[target.Identifier.ValueText] = [];
                        if (!list.Contains(id.Identifier.ValueText)) list.Add(id.Identifier.ValueText);
                    }
                }
            }
            return hints.Count == 0 ? null : hints.ToDictionary(kv => kv.Key, kv => (IReadOnlyList<string>)kv.Value);
        }

        // ── helpers ────────────────────────────────────────────────────────────────────────────

        /// <summary>Values that can be passed as object: not ref structs (Span&lt;T&gt;), pointers or ref-struct type parameters.</summary>
        private static bool Recordable(ITypeSymbol type) =>
            !type.IsRefLikeType && type.TypeKind is not (TypeKind.Pointer or TypeKind.FunctionPointer or TypeKind.Error)
            && !(type is ITypeParameterSymbol { AllowsRefLikeType: true }) && type.SpecialType != SpecialType.System_Void;

        private static string TypeText(ITypeSymbol type) => type.ToDisplayString(SymbolDisplayFormat.MinimallyQualifiedFormat);

        private static string Escape(string name) =>
            SyntaxFacts.GetKeywordKind(name) != SyntaxKind.None ? "@" + name : name;

        private bool IsConstant(ExpressionSyntax e) => model.GetConstantValue(e).HasValue;

        private int Line(SyntaxNode node) => Line(node.GetFirstToken());

        private int Line(SyntaxToken token) => _tree.GetMappedLineSpan(token.Span).StartLinePosition.Line + 1;

        private bool IsHidden(SyntaxNode node) => _tree.GetLineVisibility(node.SpanStart) != LineVisibility.Visible;

        private bool IsEntry(IMethodSymbol symbol) =>
            symbol.Name == "Main" && symbol.IsStatic && SymbolEqualityComparer.Default.Equals(model.Compilation.GetEntryPoint(default), symbol);

        /// <summary>The generated <c>static void Main() =&gt; new Snippet().RunHarness();</c> of a block of bare methods.</summary>
        private bool IsGeneratedHarnessMain(MethodDeclarationSyntax node, IMethodSymbol symbol) =>
            _shape == ProgramShape.MembersWithHarness && _file == 1 && symbol.Name == "Main" && symbol.ContainingType.Name == ProgramBuilder.WrapperClass;

        private bool IsHarnessBody(MethodDeclarationSyntax node, IMethodSymbol symbol) =>
            _shape == ProgramShape.MembersWithHarness && _file == 1 && symbol.Name == "RunHarness" && symbol.ContainingType.Name == ProgramBuilder.WrapperClass;

        private string EntryName(MethodDeclarationSyntax node, IMethodSymbol symbol) => IsHarnessBody(node, symbol) ? "harness" : "Main";

        private static string MemberName(IMethodSymbol symbol, string name) =>
            symbol.ContainingType is { } t && t.Name != ProgramBuilder.WrapperClass && !t.IsImplicitlyDeclared && t.Name != "Program" ? $"{t.Name}.{name}" : name;

        private static string AccessorOwner(IMethodSymbol accessor) => accessor.AssociatedSymbol switch
        {
            IPropertySymbol { IsIndexer: true } p => $"{p.ContainingType.Name}[]",
            IPropertySymbol p => $"{p.ContainingType.Name}.{p.Name}",
            _ => accessor.Name,
        };
    }
}
