using System.Text;
using System.Text.Json;
using LearnYourself.Runner.Debugger;
using Microsoft.CodeAnalysis;

namespace LearnYourself.Runner.Tests;

/// <summary>
/// The tracing debugger's instrumenter and recorder: line numbers, captured locals, call-stack depth, exception steps,
/// value snapshots, the step cap, and that an instrumented program behaves exactly like the plain one.
/// </summary>
public sealed class DebuggerTests
{
    private static readonly SnippetCompiler Compiler = new(
        Directory.GetFiles(Path.Combine(AppContext.BaseDirectory, "refs", "runner"), "*.dll").Select(f => MetadataReference.CreateFromFile(f)));

    internal sealed record Debugged(ExecutionTrace Trace, RunResult Run, string Output, DebugBuild Build);

    internal static async Task<Debugged> DebugAsync(string code, string? harness = null, string stdin = "", DebugLimits? limits = null)
    {
        var program = ProgramBuilder.Build(code, harness);
        var build = DebugCompiler.Compile(Compiler, program);
        Assert.True(build.CanRun, build.Error ?? string.Join("\n", build.Compiled.Errors.Select(e => $"{e.Line}: {e.Message}")));
        var session = new TraceSession(build.Sites, limits ?? DebugLimits.Default);
        var output = new StringBuilder();
        var run = await SnippetExecutor.RunAsync(build.Assembly!, build.Pdb, stdin, ExecutionLimits.Default, t => output.Append(t), session);
        return new Debugged(session.Trace!, run, output.ToString().Replace("\r\n", "\n"), build);
    }

    internal static async Task<(RunResult Run, string Output)> PlainAsync(string code, string? harness = null, string stdin = "")
    {
        var compiled = Compiler.Compile(ProgramBuilder.Build(code, harness));
        Assert.True(compiled.Success, string.Join("\n", compiled.Errors.Select(e => $"{e.Line}: {e.Message}")));
        var output = new StringBuilder();
        var run = await SnippetExecutor.RunAsync(compiled.Assembly!, compiled.Pdb, stdin, ExecutionLimits.Default, t => output.Append(t));
        return (run, output.ToString().Replace("\r\n", "\n"));
    }

    /// <summary>A value snapshot as short text: 5, "abc", [1, 2], {"a": 1}, Node { Value = 1, Next = ↻Node }.</summary>
    internal static string Show(string json) => Show(JsonDocument.Parse(json).RootElement);

    private static string Show(JsonElement v)
    {
        string Items(string prop) => string.Join(", ", v.GetProperty(prop).EnumerateArray().Select(Show));
        return v.GetProperty("k").GetString() switch
        {
            "null" => "null",
            "v" => v.GetProperty("v").GetString()!,
            "s" => "\"" + v.GetProperty("v").GetString() + "\"",
            "seq" => "[" + Items("items") + "]",
            "tup" => "(" + Items("items") + ")",
            "grid" => "[" + string.Join(", ", v.GetProperty("items").EnumerateArray().Select(r => "[" + string.Join(", ", r.EnumerateArray().Select(Show)) + "]")) + "]",
            "map" => "{" + string.Join(", ", v.GetProperty("items").EnumerateArray().Select(p => Show(p[0]) + ": " + Show(p[1]))) + "}",
            "obj" => v.GetProperty("t").GetString() + " { " + string.Join(", ", v.GetProperty("f").EnumerateArray().Select(f => f[0].GetString() + " = " + Show(f[1]))) + " }",
            "ref" => "↻" + v.GetProperty("t").GetString(),
            "exc" => v.GetProperty("t").GetString() + ": " + v.GetProperty("m").GetString(),
            _ => "<" + v.GetProperty("t").GetString() + ">",
        };
    }

    private static Dictionary<string, string> Vars(ExecutionTrace t, int step) => t.VariablesAt(step).ToDictionary(v => v.Name, v => Show(v.Value));

    private static List<int> LineSteps(ExecutionTrace t) => [.. t.Steps.Where(s => s.Kind == StepKind.Line).Select(s => s.Line)];

    private static int FirstStepAt(ExecutionTrace t, int line, StepKind kind = StepKind.Line) => t.Steps.ToList().FindIndex(s => s.Line == line && s.Kind == kind && s.File == 0);

    // ── line numbers ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Steps_follow_the_statements_line_by_line()
    {
        var d = await DebugAsync("int a = 1;\nint b = a + 1;\nConsole.WriteLine(a + b);");
        Assert.Equal([1, 2, 3], LineSteps(d.Trace));
        Assert.Equal(StepKind.End, d.Trace.Steps[^1].Kind);
        Assert.Equal("3\n", d.Output);
        Assert.Equal(2, d.Build.Level);
        // the output so far, at each step: nothing before line 3 runs, everything at the end
        Assert.Equal(0, d.Trace.Steps[2].Output);
        Assert.Equal(d.Output.Length, d.Trace.Steps[^1].Output, 1); // ("\n" vs "\r\n" on Windows)
    }

    [Fact]
    public async Task Lines_are_the_learners_after_types_move_and_comments()
    {
        // the class is declared first, so the program builder moves it after the statements (with #line)
        const string code = "class P\n{\n    public int X;\n}\n\n// a comment\nvar p = new P();\np.X = 4;\nConsole.WriteLine(p.X);";
        var d = await DebugAsync(code);
        Assert.Equal([7, 8, 9], LineSteps(d.Trace));
        Assert.Equal("4\n", d.Output);
    }

    [Fact]
    public async Task Loop_conditions_get_a_step_each_time_they_are_checked()
    {
        var d = await DebugAsync("for (int i = 0; i < 3; i++)\n{\n    Console.WriteLine(i);\n}");
        var header = d.Trace.Steps.Select((s, i) => (s, i)).Where(x => x.s.Kind == StepKind.Line && x.s.Line == 1).ToList();
        Assert.Equal(["0", "1", "2", "3"], header.Select(x => Vars(d.Trace, x.i)["i"]));
        Assert.Equal(3, d.Trace.Steps.Count(s => s.Kind == StepKind.Line && s.Line == 3));
    }

    [Fact]
    public async Task Foreach_records_the_loop_variable_on_its_line()
    {
        var d = await DebugAsync("var xs = new[] { 5, 6 };\nforeach (var x in xs)\n    Console.WriteLine(x);");
        var onForeach = d.Trace.Steps.Select((s, i) => (s, i)).Where(x => x.s.Line == 2).Select(x => Vars(d.Trace, x.i).GetValueOrDefault("x")).ToList();
        Assert.Equal([null, "5", "6"], onForeach);
        Assert.Equal("5\n6\n", d.Output);
    }

    // ── captured locals ───────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Only_locals_that_are_definitely_assigned_are_captured()
    {
        const string code = "int x;\nbool c = true;\nif (c) x = 1; else x = 2;\nConsole.WriteLine(x);\nint later = 5;\nConsole.WriteLine(later);";
        var d = await DebugAsync(code);
        Assert.Equal(["c"], Vars(d.Trace, FirstStepAt(d.Trace, 3)).Keys);
        Assert.Equal(new Dictionary<string, string> { ["c"] = "true", ["x"] = "1" }, Vars(d.Trace, FirstStepAt(d.Trace, 4)));
        Assert.DoesNotContain("later", Vars(d.Trace, FirstStepAt(d.Trace, 5)).Keys);
        Assert.Equal("5", Vars(d.Trace, FirstStepAt(d.Trace, 6))["later"]);
    }

    [Fact]
    public async Task Parameters_and_out_parameters_after_assignment()
    {
        const string code = "bool TryHalf(int n, out int half)\n{\n    half = n / 2;\n    return n % 2 == 0;\n}\nTryHalf(8, out var h);\nConsole.WriteLine(h);";
        var d = await DebugAsync(code);
        var call = d.Trace.Steps.ToList().FindIndex(s => s.Kind == StepKind.Call);
        Assert.Equal(new Dictionary<string, string> { ["n"] = "8" }, Vars(d.Trace, call));
        Assert.Equal(new Dictionary<string, string> { ["n"] = "8", ["half"] = "4" }, Vars(d.Trace, FirstStepAt(d.Trace, 4)));
        var ret = d.Trace.Steps.Single(s => s.Kind == StepKind.Return);
        Assert.Equal("true", Show(d.Trace.Values[ret.Value]));
    }

    [Fact]
    public async Task Instance_members_show_this_with_its_fields()
    {
        const string code = "var c = new Counter();\nc.Add(2);\nConsole.WriteLine(c.Total);\nclass Counter\n{\n    public int Total { get; private set; }\n    public void Add(int n)\n    {\n        Total += n;\n    }\n}";
        var d = await DebugAsync(code);
        var inAdd = FirstStepAt(d.Trace, 9);
        Assert.Equal(["Counter.Add", "top-level statements"], d.Trace.StackAt(inAdd));
        Assert.Equal("Counter { Total = 0 }", Vars(d.Trace, inAdd)["this"]);
        Assert.Equal("2", Vars(d.Trace, inAdd)["n"]);
    }

    [Fact]
    public async Task Fields_of_a_block_of_bare_methods_are_shown_by_name()
    {
        var d = await DebugAsync("int calls = 0;\nvoid Tick()\n{\n    calls++;\n}", "Tick();\nTick();\nConsole.WriteLine(calls);");
        var last = d.Trace.Steps.ToList().FindLastIndex(s => s.Kind == StepKind.Line && s.File == 1);
        Assert.Equal("2", Vars(d.Trace, last)["calls"]);
        Assert.Equal("2\n", d.Output);
    }

    // ── call stack ────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Recursion_pushes_one_frame_per_call_and_records_return_values()
    {
        const string code = "int Fact(int n)\n{\n    if (n <= 1) return 1;\n    return n * Fact(n - 1);\n}\nConsole.WriteLine(Fact(3));";
        var d = await DebugAsync(code);
        Assert.Equal("6\n", d.Output);
        int deepest = Enumerable.Range(0, d.Trace.Steps.Count).MaxBy(d.Trace.DepthAt);
        Assert.Equal(4, d.Trace.DepthAt(deepest));
        Assert.Equal(["Fact", "Fact", "Fact", "top-level statements"], d.Trace.StackAt(deepest));
        Assert.Equal("1", Vars(d.Trace, deepest)["n"]);
        var returns = d.Trace.Steps.Where(s => s.Kind == StepKind.Return).Select(s => Show(d.Trace.Values[s.Value])).ToList();
        Assert.Equal(["1", "2", "6"], returns);
        // each frame remembers the line it called from
        var frame = d.Trace.Frames[d.Trace.Steps[deepest].Frame];
        Assert.Equal(4, frame.CallLine);
        Assert.Equal(6, d.Trace.Frames[frame.Parent].CallLine == 0 ? 6 : d.Trace.Frames[d.Trace.Frames[frame.Parent].Parent].CallLine);
    }

    [Fact]
    public async Task Expression_bodied_members_get_frames_too()
    {
        const string code = "int Sq(int x) => x * x;\nConsole.WriteLine(Sq(3) + new Box(2).Double);\nrecord Box(int V)\n{\n    public int Double => V * 2;\n}";
        var d = await DebugAsync(code);
        Assert.Equal("13\n", d.Output);
        var names = d.Trace.Steps.Where(s => s.Kind == StepKind.Call).Select(s => d.Trace.Methods[d.Trace.Frames[s.Frame].Method].Name).ToList();
        Assert.Equal(["Sq", "Box.Double (get)"], names);
        Assert.Contains(d.Trace.Steps, s => s.Kind == StepKind.Return && Show(d.Trace.Values[s.Value]) == "9");
    }

    [Fact]
    public async Task A_harness_is_its_own_frame_and_its_lines_are_in_harness_cs()
    {
        const string sort = "void InsertionSort(int[] arr)\n{\n    for (int i = 1; i < arr.Length; i++)\n    {\n        int key = arr[i];\n        int j = i - 1;\n        while (j >= 0 && arr[j] > key)\n        {\n            arr[j + 1] = arr[j];\n            j--;\n        }\n        arr[j + 1] = key;\n    }\n}";
        var d = await DebugAsync(sort, "int[] arr = { 2, 5, 7, 3 };\nInsertionSort(arr);\nConsole.WriteLine(string.Join(\", \", arr));");
        Assert.Equal("2, 3, 5, 7\n", d.Output);
        var first = d.Trace.Steps[0];
        Assert.Equal((StepKind.Line, 1, 1), (first.Kind, first.File, first.Line));
        Assert.Equal(["harness"], d.Trace.StackAt(0));
        var call = d.Trace.Steps.ToList().FindIndex(s => s.Kind == StepKind.Call);
        Assert.Equal((0, 1), (d.Trace.Steps[call].File, d.Trace.Steps[call].Line));
        Assert.Equal("[2, 5, 7, 3]", Vars(d.Trace, call)["arr"]);
        var method = d.Trace.Methods[d.Trace.Frames[d.Trace.Steps[call].Frame].Method];
        Assert.Equal(["i", "j"], method.IndexHints!["arr"]);
        // the void method's return step is on its closing brace
        Assert.Contains(d.Trace.Steps, s => s.Kind == StepKind.Return && s.Line == 14);
    }

    [Fact]
    public async Task Lambdas_with_a_body_are_frames_and_expression_lambdas_are_not()
    {
        const string code = "var xs = new List<int> { 1, 2, 3 };\nvar odd = xs.Where(x => x % 2 == 1).Select(x =>\n{\n    int y = x * 10;\n    return y;\n}).ToList();\nConsole.WriteLine(string.Join(\",\", odd));";
        var d = await DebugAsync(code);
        Assert.Equal("10,30\n", d.Output);
        var inLambda = d.Trace.Steps.ToList().FindIndex(s => s.Line == 5);
        Assert.Equal(["lambda", "top-level statements"], d.Trace.StackAt(inLambda));
        Assert.Equal(new Dictionary<string, string> { ["x"] = "1", ["y"] = "10" }, Vars(d.Trace, inLambda));
    }

    // ── exceptions ────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task An_uncaught_exception_is_the_last_step_on_its_line()
    {
        const string code = "Console.WriteLine(\"before\");\nint[] a = new int[2];\na[5] = 1;";
        var d = await DebugAsync(code);
        var last = d.Trace.Steps[^1];
        Assert.Equal((StepKind.Exception, 3), (last.Kind, last.Line));
        Assert.StartsWith("System.IndexOutOfRangeException: ", Show(d.Trace.Values[last.Value]));
        Assert.Equal("exception", d.Run.Outcome);
        Assert.Equal(3, d.Run.Error!.Line);
        Assert.Equal("before\n", d.Output);
    }

    [Fact]
    public async Task An_exception_in_a_callee_is_recorded_in_the_callee_frame()
    {
        const string code = "int Div(int a, int b)\n{\n    return a / b;\n}\nConsole.WriteLine(Div(1, 0));";
        var d = await DebugAsync(code);
        var ex = d.Trace.Steps.Single(s => s.Kind == StepKind.Exception);
        Assert.Equal(3, ex.Line);
        Assert.Equal(["Div", "top-level statements"], d.Trace.StackAt(d.Trace.Steps.ToList().IndexOf(ex)));
        Assert.Equal(StepKind.Exception, d.Trace.Steps[^1].Kind); // no "return" steps while it unwinds
        var plain = await PlainAsync(code);
        Assert.Equal(plain.Run.Error!.Line, d.Run.Error!.Line);
    }

    [Fact]
    public async Task A_caught_exception_is_shown_where_it_was_thrown_then_the_catch_runs()
    {
        const string code = "try\n{\n    int.Parse(\"x\");\n}\ncatch (FormatException)\n{\n    Console.WriteLine(\"caught\");\n}";
        var d = await DebugAsync(code);
        var ex = d.Trace.Steps.ToList().FindIndex(s => s.Kind == StepKind.Exception);
        Assert.True(ex > 0);
        Assert.Equal(3, d.Trace.Steps[ex].Line);
        Assert.StartsWith("System.FormatException", Show(d.Trace.Values[d.Trace.Steps[ex].Value]));
        Assert.Equal(7, d.Trace.Steps[ex + 1].Line);
        Assert.Equal("completed", d.Run.Outcome);
    }

    // ── limits ────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task The_step_cap_stops_an_endless_loop()
    {
        var d = await DebugAsync("while (true) { }", limits: new DebugLimits(MaxSteps: 500));
        Assert.Equal("trace-limit", d.Run.Outcome);
        Assert.Equal("steps", d.Trace.Stop);
        Assert.InRange(d.Trace.Steps.Count, 490, 500);
        Assert.Null(d.Run.Error);
    }

    [Fact]
    public async Task The_step_cap_holds_when_the_program_catches_everything()
    {
        // the cap's exception is caught by the learner's catch: every further step throws again, so the loop still ends
        const string code = "int n = 0;\nwhile (n < 1000000)\n{\n    try { n++; } catch (Exception) { n++; }\n}\nConsole.WriteLine(n);";
        var d = await DebugAsync(code, limits: new DebugLimits(MaxSteps: 300));
        Assert.Equal("steps", d.Trace.Stop);
        Assert.InRange(d.Trace.Steps.Count, 290, 300);
    }

    [Fact]
    public async Task The_depth_cap_stops_endless_recursion()
    {
        var d = await DebugAsync("int F(int n) => F(n + 1);\nF(0);", limits: new DebugLimits(MaxDepth: 50));
        Assert.Equal("trace-limit", d.Run.Outcome);
        Assert.Equal("depth", d.Trace.Stop);
        Assert.Equal(50, d.Trace.Steps.Max(s => d.Trace.Frames[s.Frame].Depth));
    }

    // ── value snapshots ───────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Snapshots_cover_collections_objects_and_cycles()
    {
        const string code = """
            var list = new List<int> { 1, 2 };
            var map = new Dictionary<string, int> { ["a"] = 1 };
            var node = new Node { Value = 1 };
            node.Next = node;
            var grid = new int[2, 2] { { 1, 2 }, { 3, 4 } };
            var pair = (1, "b");
            var word = "hi";
            char c = 'x';
            double d = 0.5;
            Color col = Color.Red;
            int? none = null;
            Console.WriteLine(list.Count);
            class Node { public int Value { get; set; } public Node Next; }
            enum Color { Red, Green }
            """;
        var dbg = await DebugAsync(code);
        var vars = Vars(dbg.Trace, FirstStepAt(dbg.Trace, 12));
        Assert.Equal("[1, 2]", vars["list"]);
        Assert.Equal("{\"a\": 1}", vars["map"]);
        Assert.Equal("Node { Value = 1, Next = ↻Node }", vars["node"]);
        Assert.Equal("[[1, 2], [3, 4]]", vars["grid"]);
        Assert.Equal("(1, \"b\")", vars["pair"]);
        Assert.Equal("\"hi\"", vars["word"]);
        Assert.Equal("'x'", vars["c"]);
        Assert.Equal("0.5", vars["d"]);
        Assert.Equal("Color.Red", vars["col"]);
        Assert.Equal("null", vars["none"]);
        Assert.Equal("int?", dbg.Trace.VariablesAt(FirstStepAt(dbg.Trace, 12)).Single(v => v.Name == "none").Type);
    }

    [Fact]
    public async Task Snapshots_never_run_the_learners_code()
    {
        // a getter and a ToString override that print: the debugger must not call them
        const string code = """
            var s = new Spy();
            Console.WriteLine("done");
            class Spy
            {
                private int _n = 3;
                public int N { get { Console.WriteLine("getter ran"); return _n; } }
                public override string ToString() { Console.WriteLine("ToString ran"); return "spy"; }
            }
            """;
        var d = await DebugAsync(code);
        Assert.Equal("done\n", d.Output);
        Assert.Equal("Spy { _n = 3 }", Vars(d.Trace, FirstStepAt(d.Trace, 2))["s"]);
    }

    [Fact]
    public async Task Large_collections_are_cut_to_the_first_items()
    {
        var d = await DebugAsync("var xs = Enumerable.Range(0, 500).ToArray();\nConsole.WriteLine(xs.Length);");
        var json = JsonDocument.Parse(d.Trace.VariablesAt(FirstStepAt(d.Trace, 2)).Single().Value).RootElement;
        Assert.Equal(500, json.GetProperty("n").GetInt32());
        Assert.Equal(64, json.GetProperty("items").GetArrayLength());
    }

    // ── instrumentation levels and the trace format ───────────────────────────────────────────

    [Fact]
    public async Task A_condition_whose_assignment_is_used_after_the_loop_falls_back_to_level_1()
    {
        // `Cond() && (cond)` would make x "not definitely assigned" after the loop, so level 2 can't compile
        const string code = "var q = new Queue<int>(new[] { 3, 2, 0 });\nint x;\nwhile ((x = q.Dequeue()) != 0) Console.WriteLine(x);\nConsole.WriteLine(x);";
        var d = await DebugAsync(code);
        Assert.Equal(1, d.Build.Level);
        Assert.Equal((await PlainAsync(code)).Output, d.Output);
    }

    [Fact]
    public async Task The_trace_json_is_well_formed()
    {
        var d = await DebugAsync("var xs = new[] { 1, 2 };\nforeach (var x in xs) Console.WriteLine(\"\\\"\" + x);");
        using var doc = JsonDocument.Parse(d.Trace.ToJson());
        var root = doc.RootElement;
        Assert.Equal(d.Trace.Steps.Count, root.GetProperty("steps").GetArrayLength());
        Assert.Equal(7, root.GetProperty("steps")[0].GetArrayLength());
        Assert.Equal(JsonValueKind.Null, root.GetProperty("stop").ValueKind);
    }

    // ── behaviour is unchanged ────────────────────────────────────────────────────────────────

    public static TheoryData<string, string?, string> Programs() => new()
    {
        { "Console.WriteLine(string.Join(\",\", Enumerable.Range(1, 5).Where(x => x % 2 == 1).Select(x => x * x)));", null, "" },
        { "IEnumerable<int> Gen(int n)\n{\n    for (int i = 0; i < n; i++)\n    {\n        yield return i * 2;\n    }\n}\nforeach (var v in Gen(3)) Console.WriteLine(v);\nConsole.WriteLine(Gen(10).Take(2).Sum());", null, "" },
        { "var p = new Point(1, 2);\nvar q = p with { Y = 5 };\nConsole.WriteLine(p);\nConsole.WriteLine(q == p);\nrecord Point(int X, int Y);", null, "" },
        { "var v = new V(1, 2) + new V(3, 4);\nConsole.WriteLine($\"{v.X},{v.Y}\");\nstruct V\n{\n    public int X, Y;\n    public V(int x, int y) { X = x; Y = y; }\n    public static V operator +(V a, V b) => new V(a.X + b.X, a.Y + b.Y);\n}", null, "" },
        { "object[] things = { 1, \"two\", 3.5, null };\nforeach (var t in things)\n{\n    switch (t)\n    {\n        case int i when i > 0:\n            Console.WriteLine(\"int \" + i);\n            break;\n        case string s:\n            Console.WriteLine(\"string \" + s);\n            break;\n        case null:\n            Console.WriteLine(\"null\");\n            break;\n        default:\n            Console.WriteLine(t switch { double d => \"double \" + d, _ => \"?\" });\n            break;\n    }\n}", null, "" },
        { "int Work()\n{\n    try\n    {\n        throw new InvalidOperationException(\"boom\");\n    }\n    catch (InvalidOperationException e) when (e.Message == \"boom\")\n    {\n        return 1;\n    }\n    finally\n    {\n        Console.WriteLine(\"finally\");\n    }\n}\nConsole.WriteLine(Work());", null, "" },
        { "void Swap(ref int a, ref int b) { (a, b) = (b, a); }\nint x = 1, y = 2;\nSwap(ref x, ref y);\nConsole.WriteLine($\"{x} {y}\");\nstatic int Add(int a, int b) => a + b;\nConsole.WriteLine(Add(x, y));", null, "" },
        { "T Max<T>(T a, T b) where T : IComparable<T> => a.CompareTo(b) > 0 ? a : b;\nConsole.WriteLine(Max(3, 7));\nConsole.WriteLine(Max(\"a\", \"b\"));", null, "" },
        { "var s = new Stack2();\ns.Push(1); s.Push(2);\nConsole.WriteLine(s[0] + s[1] + s.Count);\nclass Stack2\n{\n    private int[] items = new int[4];\n    private int top = -1;\n    public int Count => top + 1;\n    public int this[int i] => items[i];\n    public void Push(int x) { items[++top] = x; }\n}", null, "" },
        { "Console.WriteLine(Config.Name);\nstatic class Config\n{\n    public static string Name;\n    static Config() { Name = \"cfg\"; }\n}", null, "" },
        { "int i = 0;\nstart:\ni++;\nif (i < 3) goto start;\nConsole.WriteLine(i);\ndo { i--; } while (i > 0);\nConsole.WriteLine(i);", null, "" },
        { "var d = new Dictionary<string, int> { [\"b\"] = 2, [\"a\"] = 1 };\nforeach (var (k, v) in d) Console.WriteLine(k + v);\nforeach (var kv in d.OrderBy(p => p.Key)) Console.WriteLine(kv);", null, "" },
        { "Animal[] zoo = { new Dog(), new Cat() };\nforeach (var a in zoo) Console.WriteLine(a.Speak());\nabstract class Animal { public abstract string Speak(); }\nclass Dog : Animal { public override string Speak() => \"Woof\"; }\nclass Cat : Animal { public override string Speak() { return \"Meow\"; } }", null, "" },
        { "try { throw new MyError(\"custom\"); }\ncatch (MyError e) { Console.WriteLine(e.Message + \" \" + e.Code); }\nclass MyError : Exception\n{\n    public int Code => 7;\n    public MyError(string m) : base(m) { }\n}", null, "" },
        { "var sb = new System.Text.StringBuilder();\nfor (int i = 0; i < 3; i++) sb.Append(i).Append(';');\nConsole.WriteLine(sb.ToString());\nvar name = Console.ReadLine();\nConsole.WriteLine($\"Hello {name}\");", null, "Ada" },
        { "int Fib(int n) => n < 2 ? n : Fib(n - 1) + Fib(n - 2);\nConsole.WriteLine(Fib(10));", null, "" },
        { "using System;\nclass Program\n{\n    static int counter;\n    static void Main(string[] args)\n    {\n        for (int i = 0; i < 3; i++) Increment();\n        Console.WriteLine(counter);\n    }\n    static void Increment() => counter++;\n}", null, "" },
        { "int[] a = { 5, 1, 4 };\nArray.Sort(a);\nConsole.WriteLine(string.Join(\" \", a));\nint idx = Array.BinarySearch(a, 4);\nConsole.WriteLine(idx);\nchecked { int big = int.MaxValue; try { big++; } catch (OverflowException) { Console.WriteLine(\"overflow\"); } }", null, "" },
        { "void BubbleSort(int[] arr)\n{\n    int n = arr.Length;\n    for (int i = 0; i < n - 1; i++)\n        for (int j = 0; j < n - i - 1; j++)\n            if (arr[j] > arr[j + 1])\n                (arr[j], arr[j + 1]) = (arr[j + 1], arr[j]);\n}", "int[] arr = { 2, 5, 7, 3 };\nBubbleSort(arr);\nConsole.WriteLine(\"[\" + string.Join(\", \", arr) + \"]\");", "" },
        { "class Employee\n{\n    public string Name { get; set; }\n    public int Age { get; set; }\n    public override string ToString() => $\"{Name} ({Age})\";\n}", "var e = new Employee { Name = \"Ann\", Age = 30 };\nConsole.WriteLine(e);", "" },
        { "var nums = new List<int> { 3, 1, 2 };\nnums.Sort((a, b) => { return b.CompareTo(a); });\nConsole.WriteLine(string.Join(\",\", nums));\nFunc<int, int> twice = x => { var r = x * 2; return r; };\nConsole.WriteLine(twice(21));\nAction hello = delegate { Console.WriteLine(\"hi\"); };\nhello();", null, "" },
        { "int x = 10;\nwhile (x > 0)\n{\n    x -= 3;\n    if (x == 4) continue;\n    if (x < 2) break;\n    Console.WriteLine(x);\n}\nfor (;;) { x++; if (x > 3) break; }\nConsole.WriteLine(x);", null, "" },
        { "Console.WriteLine(Describe(5));\nConsole.WriteLine(Describe(-1));\nstring Describe(int n)\n{\n    if (n > 0)\n        return \"positive\";\n    else if (n < 0)\n        return \"negative\";\n    else\n        return \"zero\";\n}", null, "" },
        { "int[] data = { 1, 2, 3 };\nConsole.WriteLine(data[3]);", null, "" },
        { "var q = new PriorityQueue<string, int>();\nq.Enqueue(\"b\", 2);\nq.Enqueue(\"a\", 1);\nConsole.WriteLine(q.Dequeue());\nvar set = new HashSet<int> { 1, 2, 2 };\nConsole.WriteLine(set.Count);\nvar ll = new LinkedList<int>(new[] { 1, 2 });\nConsole.WriteLine(ll.First!.Value);", null, "" },
    };

    [Theory]
    [MemberData(nameof(Programs))]
    public async Task Instrumented_programs_print_what_the_plain_program_prints(string code, string? harness, string stdin)
    {
        var plain = await PlainAsync(code, harness, stdin);
        var d = await DebugAsync(code, harness, stdin);
        Assert.Equal(plain.Output, d.Output);
        Assert.Equal(plain.Run.Outcome, d.Run.Outcome);
        Assert.Equal(plain.Run.Error?.Type, d.Run.Error?.Type);
        Assert.Equal(plain.Run.Error?.Message, d.Run.Error?.Message);
        Assert.Equal(plain.Run.Error?.Line, d.Run.Error?.Line);
        Assert.NotEmpty(d.Trace.Steps);
    }

    [Fact]
    public void Compile_errors_are_the_learners_not_the_instrumenters()
    {
        var build = DebugCompiler.Compile(Compiler, ProgramBuilder.Build("int x = 1;\nint y = \"two\";", null));
        Assert.False(build.Compiled.Success);
        var e = Assert.Single(build.Compiled.Errors);
        Assert.Equal(("CS0029", 2), (e.Id, e.Line));
    }
}
