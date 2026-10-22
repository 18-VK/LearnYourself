// Runner.Check: decides which C# blocks of the lessons get a Run button, and records their expected output.
//   check <input.json> <output.json> [--jobs N] [--work DIR]   (called by scripts/runner/check.ts)
//   exec-batch <batch.json> <maxOutputChars>                   (internal: the child process that runs programs)
using System.Diagnostics;
using System.Text.Json;
using LearnYourself.Runner;
using LearnYourself.Runner.Check;

if (args.Length >= 3 && args[0] == "exec-batch")
{
    return await BatchRunner.ChildMainAsync(args[1], int.Parse(args[2], System.Globalization.CultureInfo.InvariantCulture));
}
if (args.Length < 3 || args[0] != "check")
{
    Console.Error.WriteLine("usage: Runner.Check check <input.json> <output.json> [--jobs N] [--work DIR]");
    return 2;
}

var inputPath = args[1];
var outputPath = args[2];
int jobs = Math.Clamp(Environment.ProcessorCount / 2, 1, 4);
string work = Path.GetTempPath();
for (int i = 3; i < args.Length - 1; i++)
{
    if (args[i] == "--jobs") jobs = int.Parse(args[i + 1], System.Globalization.CultureInfo.InvariantCulture);
    if (args[i] == "--work") work = args[i + 1];
}
Directory.CreateDirectory(work);

var input = JsonSerializer.Deserialize(await File.ReadAllTextAsync(inputPath), CheckJson.Default.CheckInput)
    ?? throw new InvalidOperationException("empty input");
var sw = Stopwatch.StartNew();
var checker = new Checker(Path.Combine(AppContext.BaseDirectory, "refs"));
var verdicts = checker.AnalyzeAll(input.Programs, jobs);
Console.WriteLine($"check: analyzed {verdicts.Count} programs in {sw.Elapsed.TotalSeconds:F1} s; {verdicts.Count(v => v.Runnable)} compile for the browser");

// Run every candidate twice, in two independent child processes at the same time.
var candidates = verdicts.Where(v => v.Runnable).ToList();
var stdinOf = input.Programs.ToDictionary(p => p.Id, p => p.Stdin);
var batch = candidates.Select(v => new BatchItem(v.Id, v.Assembly!, v.Pdb, stdinOf[v.Id])).ToList();
sw.Restart();
var runs = await Task.WhenAll(
    BatchRunner.RunAsync(batch, input.TimeoutMs, input.MaxOutputChars, work),
    BatchRunner.RunAsync(batch, input.TimeoutMs, input.MaxOutputChars, work));
Console.WriteLine($"check: ran {candidates.Count} programs twice in {sw.Elapsed.TotalSeconds:F1} s");

var host = HostStrings();
var final = new List<CheckVerdict>(verdicts.Count);
var index = candidates.Select((v, i) => (v.Id, i)).ToDictionary(x => x.Id, x => x.i);
foreach (var v in verdicts)
{
    if (!v.Runnable) { final.Add(v); continue; }
    var i = index[v.Id];
    var a = runs[0][i];
    var b = runs[1][i];
    if (a.Outcome is "timeout" or "crash" || b.Outcome is "timeout" or "crash")
    {
        var outcome = a.Outcome is "timeout" or "crash" ? a.Outcome : b.Outcome;
        final.Add(v with
        {
            Runnable = false,
            Category = outcome,
            Reason = outcome == "timeout" ? $"still running after {input.TimeoutMs / 1000} s" : "the process exited during the run (Environment.Exit or a stack overflow?)",
            Runs = [a, b],
        });
        continue;
    }
    bool same = a.Stdout == b.Stdout && a.Outcome == b.Outcome && a.Error?.Type == b.Error?.Type && a.Error?.Message == b.Error?.Message;
    bool hostData = host.Any(h => a.Stdout.Contains(h, StringComparison.OrdinalIgnoreCase) || (a.Error?.Message.Contains(h, StringComparison.OrdinalIgnoreCase) ?? false));
    bool needsInput = v.ReadsInput && string.IsNullOrEmpty(stdinOf[v.Id]);
    bool varies = !same || hostData || v.VariesReason is not null;
    final.Add(v with
    {
        Varies = varies,
        VariesReason = v.VariesReason ?? (!same ? "the two runs printed different output" : hostData ? "the output contains details of the build machine" : null),
        Runs = [a, b],
        Expected = !varies && !needsInput ? a : null,
    });
}

var output = new CheckOutput
{
    Tool = typeof(Checker).Assembly.GetName().Version?.ToString() ?? "",
    Sdk = Environment.Version.ToString(),
    References = checker.ReferenceNames,
    Programs = final,
};
await File.WriteAllTextAsync(outputPath, JsonSerializer.Serialize(output, CheckJson.Default.CheckOutput));
Console.WriteLine($"check: {final.Count(v => v.Runnable)} runnable, {final.Count(v => v.Runnable && v.Varies)} with output that varies");
return 0;

// Machine-specific strings that must never appear in a published "Expected output".
static List<string> HostStrings()
{
    var list = new List<string>();
    void Add(string? s) { if (!string.IsNullOrWhiteSpace(s) && s.Length >= 3) list.Add(s); }
    Add(Environment.MachineName);
    Add(Environment.UserName);
    Add(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile));
    Add(Directory.GetCurrentDirectory());
    Add(AppContext.BaseDirectory.TrimEnd('/', '\\'));
    return list;
}
