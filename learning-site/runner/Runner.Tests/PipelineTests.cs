using LearnYourself.Runner.Check;
using Microsoft.CodeAnalysis;

namespace LearnYourself.Runner.Tests;

/// <summary>Program shapes, line mapping, and execution: the parts the browser and the check share.</summary>
public sealed class PipelineTests
{
    private static readonly SnippetCompiler Compiler = new(
        Directory.GetFiles(Path.Combine(AppContext.BaseDirectory, "refs", "runner"), "*.dll").Select(f => MetadataReference.CreateFromFile(f)));

    private static async Task<(CompileResult Compile, RunResult? Run, string Output)> RunAsync(string code, string? harness = null, string stdin = "", int maxOutput = 64 * 1024)
    {
        var program = ProgramBuilder.Build(code, harness);
        var compiled = Compiler.Compile(program);
        if (!compiled.Success) return (compiled, null, "");
        var output = new System.Text.StringBuilder();
        var run = await SnippetExecutor.RunAsync(compiled.Assembly!, compiled.Pdb, stdin, new ExecutionLimits(maxOutput), t => output.Append(t));
        return (compiled, run, output.ToString().Replace("\r\n", "\n"));
    }

    [Fact]
    public async Task Top_level_statements_run_with_the_standard_usings()
    {
        var (c, r, output) = await RunAsync("var xs = new List<int> { 3, 1, 2 };\nConsole.WriteLine(string.Join(\",\", xs.OrderBy(x => x)));");
        Assert.True(c.Success);
        Assert.Equal("completed", r!.Outcome);
        Assert.Equal("1,2,3\n", output);
    }

    [Fact]
    public async Task Harness_calls_local_function_blocks()
    {
        const string insertion = "void InsertionSort(int[] arr)\n{\n    for (int i = 1; i < arr.Length; i++)\n    {\n        int key = arr[i];\n        int j = i - 1;\n        while (j >= 0 && arr[j] > key)\n        {\n            arr[j + 1] = arr[j];\n            j--;\n        }\n        arr[j + 1] = key;\n    }\n}";
        var (_, r, output) = await RunAsync(insertion, "int[] arr = { 2, 5, 7, 3 };\nInsertionSort(arr);\nConsole.WriteLine(string.Join(\", \", arr));");
        Assert.Equal("completed", r!.Outcome);
        Assert.Equal("2, 3, 5, 7\n", output);
    }

    [Fact]
    public void Compile_errors_point_at_the_learners_line_after_wrapping()
    {
        // line 3 of the block has the error; the block is wrapped in a class, so this checks the #line mapping
        var program = ProgramBuilder.Build("void A()\n{\n    int x = \"text\";\n}", "A();");
        var c = Compiler.Compile(program);
        var e = Assert.Single(c.Errors);
        Assert.Equal("CS0029", e.Id);
        Assert.Equal(ProgramBuilder.SnippetPath, e.File);
        Assert.Equal(3, e.Line);
        Assert.Equal(13, e.Column);
    }

    [Fact]
    public void Harness_errors_are_reported_in_the_harness()
    {
        var c = Compiler.Compile(ProgramBuilder.Build("void A() { }", "\nB();"));
        var e = Assert.Single(c.Errors);
        Assert.Equal(ProgramBuilder.HarnessPath, e.File);
        Assert.Equal(2, e.Line);
    }

    [Fact]
    public void Top_level_harness_goes_before_type_declarations()
    {
        var program = ProgramBuilder.Build("int n = 2;\nclass Box { public int V = 1; }", "Console.WriteLine(n + new Box().V);");
        Assert.Equal(ProgramShape.TopLevel, program.Shape);
        Assert.True(Compiler.Compile(program).Success);
    }

    [Fact]
    public async Task Runtime_exceptions_report_type_message_and_line()
    {
        var (_, r, output) = await RunAsync("Console.WriteLine(\"before\");\nint[] a = new int[2];\nConsole.WriteLine(a[5]);");
        Assert.Equal("before\n", output);
        Assert.Equal("exception", r!.Outcome);
        Assert.Equal("System.IndexOutOfRangeException", r.Error!.Type);
        Assert.Equal(3, r.Error.Line);
        Assert.Equal(ProgramBuilder.SnippetPath, r.Error.File);
    }

    [Fact]
    public async Task Exceptions_in_called_methods_report_the_throwing_line()
    {
        var (_, r, _) = await RunAsync("int Divide(int a, int b)\n{\n    return a / b;\n}", "Console.WriteLine(Divide(1, 0));");
        Assert.Equal("System.DivideByZeroException", r!.Error!.Type);
        Assert.Equal(3, r.Error.Line);
        Assert.Equal("Snippet.Divide", r.Error.Stack[0].Method);
    }

    [Fact]
    public async Task Stdin_feeds_Console_ReadLine()
    {
        var (_, r, output) = await RunAsync("string? name = Console.ReadLine();\nint n = int.Parse(Console.ReadLine()!);\nConsole.WriteLine($\"{name} {n * 2}\");", stdin: "Ada\n21\n");
        Assert.Equal("completed", r!.Outcome);
        Assert.Equal("Ada 42\n", output);
    }

    [Fact]
    public async Task Output_cap_stops_the_program()
    {
        var (_, r, output) = await RunAsync("while (true) Console.WriteLine(\"spam\");", maxOutput: 1000);
        Assert.Equal("output-limit", r!.Outcome);
        Assert.True(r.OutputTruncated);
        Assert.True(output.Length <= 1000);
    }

    [Fact]
    public async Task Async_main_is_awaited_not_blocked_on()
    {
        var (_, r, output) = await RunAsync("class P\n{\n    static async Task Main()\n    {\n        await Task.Yield();\n        Console.WriteLine(\"after await\");\n    }\n}");
        Assert.Equal("completed", r!.Outcome);
        Assert.Equal("after await\n", output);
    }

    [Fact]
    public async Task Exit_code_from_int_main()
    {
        var (_, r, _) = await RunAsync("class P { static int Main() { return 3; } }");
        Assert.Equal(3, r!.ExitCode);
    }

    [Fact]
    public void Members_block_without_harness_or_main_has_nothing_to_run()
    {
        Assert.Equal(ProgramShape.NothingToRun, ProgramBuilder.Build("void A() { }", null).Shape);
        Assert.Equal(ProgramShape.NothingToRun, ProgramBuilder.Build("class A { }", null).Shape);
        Assert.Equal(ProgramShape.EntryPoint, ProgramBuilder.Build("class A { static void Main() { } }", null).Shape);
    }

    [Fact]
    public async Task Batch_runner_kills_endless_loops_and_continues()
    {
        var items = new List<BatchItem>();
        foreach (var code in new[] { "Console.WriteLine(\"one\");", "while (true) { }", "Console.WriteLine(\"three\");" })
        {
            var c = Compiler.Compile(ProgramBuilder.Build(code, null));
            Assert.True(c.Success);
            items.Add(new BatchItem(code, c.Assembly!, c.Pdb, ""));
        }
        var work = Path.Combine(Path.GetTempPath(), "ly-runner-tests");
        Directory.CreateDirectory(work);
        var runs = await BatchRunner.RunAsync(items, timeoutMs: 1500, maxOutput: 4096, work);
        Assert.Equal("completed", runs[0].Outcome);
        Assert.Equal("one\n", runs[0].Stdout);
        Assert.Equal("timeout", runs[1].Outcome);
        Assert.Equal("completed", runs[2].Outcome);
        Assert.Equal("three\n", runs[2].Stdout);
    }
}
