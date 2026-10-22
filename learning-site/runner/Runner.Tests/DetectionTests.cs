using LearnYourself.Runner.Check;

namespace LearnYourself.Runner.Tests;

/// <summary>Runnable-block detection: what Runner.Check decides for typical note snippets.</summary>
public sealed class DetectionTests
{
    private static readonly Checker Checker = new(Path.Combine(AppContext.BaseDirectory, "refs"));

    private static CheckVerdict Check(string code, string? harness = null, string? force = null) =>
        Checker.Analyze(new CheckProgram { Id = "t", Code = code, Harness = harness, Force = force });

    [Theory]
    [InlineData("Console.WriteLine(\"Hello\");")]
    [InlineData("int[] a = { 3, 1, 2 };\nArray.Sort(a);\nConsole.WriteLine(string.Join(\",\", a));")]
    [InlineData("class Program\n{\n    static void Main()\n    {\n        Console.WriteLine(42);\n    }\n}")]
    [InlineData("var list = new List<int> { 1, 2 };\nConsole.WriteLine(list.Where(x => x > 1).Count());")]
    [InlineData("var w = new StringWriter();\nw.Write(\"in memory\");\nConsole.WriteLine(w);")]
    [InlineData("var d = new Dictionary<string, int>();\nd[\"a\"] = 1;\nforeach (var kv in d) Console.WriteLine(kv);")]
    public void Self_contained_console_code_is_runnable(string code)
    {
        var v = Check(code);
        Assert.True(v.Runnable, $"{v.Category}: {v.Reason}");
    }

    [Theory]
    [InlineData("var t = new Thread(() => Console.WriteLine(1));\nt.Start();", "threading")]
    [InlineData("object gate = new();\nlock (gate) { Console.WriteLine(1); }", "threading")]
    [InlineData("await Task.Delay(100);\nConsole.WriteLine(1);", "threading")]
    [InlineData("Parallel.For(0, 3, i => Console.WriteLine(i));", "threading")]
    [InlineData("var timer = new System.Timers.Timer(100);", "threading")]
    [InlineData("var text = File.ReadAllText(\"notes.txt\");", "filesystem")]
    [InlineData("Console.WriteLine(Path.Combine(\"a\", \"b\"));", "filesystem")]
    [InlineData("using var client = new System.Net.Http.HttpClient();", "network")]
    [InlineData("Console.WriteLine(Environment.MachineName);", "host")]
    [InlineData("System.Diagnostics.Process.Start(\"notepad\");", "host")]
    [InlineData("var key = Console.ReadKey();", "browser-unsupported")]
    [InlineData("Console.ForegroundColor = ConsoleColor.Red;", "browser-unsupported")]
    [InlineData("using Microsoft.EntityFrameworkCore;\npublic class AppDb : DbContext { }", "database")]
    [InlineData("using System.Data;\nvar t = new DataTable();", "database")]
    [InlineData("using System.Windows;\npublic class MainWindow : Window { }", "desktop")]
    [InlineData("using Microsoft.AspNetCore.Builder;\nvar app = WebApplication.CreateBuilder(args).Build();\napp.Run();", "aspnet")]
    [InlineData("using Some.Unknown.Package;\nConsole.WriteLine(1);", "package")]
    [InlineData("var p = new Product();", "compile-error")]
    [InlineData("Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new { A = 1 }));", "not-in-runner")]
    public void Browser_incompatible_code_is_excluded_with_a_reason(string code, string category)
    {
        var v = Check(code);
        Assert.False(v.Runnable);
        Assert.Equal(category, v.Category);
        Assert.False(string.IsNullOrWhiteSpace(v.Reason));
    }

    [Fact]
    public void Method_only_blocks_need_a_harness()
    {
        const string sort = "void BubbleSort(int[] arr)\n{\n    for (int i = 0; i < arr.Length - 1; i++)\n        for (int j = 0; j < arr.Length - i - 1; j++)\n            if (arr[j] > arr[j + 1]) (arr[j], arr[j + 1]) = (arr[j + 1], arr[j]);\n}";
        var without = Check(sort);
        Assert.False(without.Runnable);
        Assert.Equal("no-entry-point", without.Category);

        var with = Check(sort, "int[] a = { 5, 1, 4 };\nBubbleSort(a);\nConsole.WriteLine(string.Join(\" \", a));");
        Assert.True(with.Runnable, with.Reason);
        Assert.Equal(nameof(ProgramShape.MembersWithHarness), with.Shape);
    }

    [Fact]
    public void Public_static_methods_are_wrapped_in_a_class()
    {
        var v = Check("public static int Square(int x) => x * x;", "Console.WriteLine(Square(7));");
        Assert.True(v.Runnable, v.Reason);
    }

    [Fact]
    public void Classes_without_main_take_the_harness_as_top_level_statements()
    {
        var v = Check("public class Counter\n{\n    public int Value { get; private set; }\n    public void Add() => Value++;\n}", "var c = new Counter();\nc.Add();\nConsole.WriteLine(c.Value);");
        Assert.True(v.Runnable, v.Reason);
        Assert.Equal(nameof(ProgramShape.TypesWithHarness), v.Shape);
    }

    [Fact]
    public void Forced_off_wins_and_forced_on_skips_the_semantic_exclusions()
    {
        Assert.Equal("forced-off", Check("Console.WriteLine(1);", force: "off").Category);
        Assert.True(Check("Console.WriteLine(Path.GetExtension(\"a.txt\"));", force: "on").Runnable);
    }

    [Theory]
    [InlineData("Console.WriteLine(DateTime.Today.Year - 2000);", true)]
    [InlineData("Console.WriteLine(new Random().Next(10));", true)]
    [InlineData("Console.WriteLine(Guid.NewGuid());", true)]
    [InlineData("Console.WriteLine(new Random(42).Next(10));", false)]
    [InlineData("Console.WriteLine(new DateTime(2000, 1, 1).Year);", false)]
    public void Clock_and_randomness_mean_the_output_varies(string code, bool varies)
    {
        var v = Check(code);
        Assert.True(v.Runnable, v.Reason);
        Assert.Equal(varies, v.VariesReason is not null);
    }

    [Fact]
    public void Reading_stdin_is_detected()
    {
        var v = Check("var name = Console.ReadLine();\nConsole.WriteLine($\"Hi {name}\");");
        Assert.True(v.Runnable);
        Assert.True(v.ReadsInput);
        Assert.False(Check("Console.WriteLine(1);").ReadsInput);
    }

    [Fact]
    public void Only_the_runner_reference_set_counts_for_the_browser()
    {
        Assert.Contains("System.Runtime", Checker.ReferenceNames);
        Assert.Contains("System.Console", Checker.ReferenceNames);
        Assert.DoesNotContain("System.Net.Http", Checker.ReferenceNames);
    }
}
