using System.Diagnostics;
using System.Text.Json;

namespace LearnYourself.Runner.Check;

/// <summary>
/// Runs compiled programs in a child process ("exec-batch"), one after another, each in its own AssemblyLoadContext
/// with Console redirected. The parent enforces a hard timeout per program: if a program doesn't report back in time
/// (an endless loop, a blocking read) or kills the process (Environment.Exit, stack overflow), the child is killed and
/// a fresh one continues with the next program. Two independent batches give the two runs used to spot output that
/// varies (random numbers, clocks, hash codes — string hashing is randomized per process).
/// </summary>
public static class BatchRunner
{
    private const string StartMark = "\u0001START ";
    private const string ResultMark = "\u0001RESULT ";

    public static async Task<RunRecord[]> RunAsync(IReadOnlyList<BatchItem> items, int timeoutMs, int maxOutput, string workDir)
    {
        var results = new RunRecord?[items.Count];
        int next = 0;
        while (next < items.Count)
        {
            var file = Path.Combine(workDir, $"batch-{Environment.ProcessId}-{Guid.NewGuid():N}.json");
            await File.WriteAllTextAsync(file, JsonSerializer.Serialize(items.Skip(next).ToList(), CheckJson.Default.ListBatchItem));
            var psi = ChildStartInfo(file, maxOutput);
            using var child = Process.Start(psi) ?? throw new InvalidOperationException("Could not start the child process.");
            int current = -1;
            var stopwatch = Stopwatch.StartNew();
            var lines = Channel(child);
            bool killed = false;
            while (true)
            {
                var remaining = current < 0 ? 30_000 : timeoutMs + 1000 - (int)stopwatch.ElapsedMilliseconds;
                var line = await lines.ReadAsync(Math.Max(remaining, 1));
                if (line is null && lines.Completed) break; // process exited
                if (line is null)
                {
                    // timed out: the current program never reported back
                    if (current >= 0) results[next + current] = new RunRecord { Outcome = "timeout", Ms = stopwatch.Elapsed.TotalMilliseconds };
                    try { child.Kill(entireProcessTree: true); } catch (InvalidOperationException) { }
                    killed = true;
                    break;
                }
                if (line.StartsWith(StartMark, StringComparison.Ordinal))
                {
                    current = int.Parse(line[StartMark.Length..], System.Globalization.CultureInfo.InvariantCulture);
                    stopwatch.Restart();
                }
                else if (line.StartsWith(ResultMark, StringComparison.Ordinal) && current >= 0)
                {
                    results[next + current] = JsonSerializer.Deserialize(line[ResultMark.Length..], CheckJson.Default.RunRecord);
                }
            }
            await child.WaitForExitAsync();
            File.Delete(file);
            if (!killed && current >= 0 && results[next + current] is null)
            {
                results[next + current] = new RunRecord { Outcome = "crash", Stdout = "", Ms = stopwatch.Elapsed.TotalMilliseconds };
            }
            // continue after the last program that has a result
            int done = next;
            while (done < items.Count && results[done] is not null) done++;
            if (done == next) results[next] = new RunRecord { Outcome = "crash" }; // the child died before starting it
            next = Math.Max(done, next + 1);
        }
        return [.. results.Select(r => r ?? new RunRecord { Outcome = "crash" })];
    }

    private static ProcessStartInfo ChildStartInfo(string file, int maxOutput)
    {
        // `dotnet Runner.Check.dll exec-batch …`, with the same dotnet host as this process (also when called from tests)
        var exe = Environment.ProcessPath!;
        if (!Path.GetFileNameWithoutExtension(exe).Equals("dotnet", StringComparison.OrdinalIgnoreCase)) exe = Environment.GetEnvironmentVariable("DOTNET_HOST_PATH") ?? "dotnet";
        var psi = new ProcessStartInfo { RedirectStandardOutput = true, RedirectStandardError = true, RedirectStandardInput = true, UseShellExecute = false };
        psi.FileName = exe;
        psi.ArgumentList.Add(typeof(BatchRunner).Assembly.Location);
        psi.ArgumentList.Add("exec-batch");
        psi.ArgumentList.Add(file);
        psi.ArgumentList.Add(maxOutput.ToString(System.Globalization.CultureInfo.InvariantCulture));
        psi.Environment["DOTNET_TieredCompilation"] = "1";
        return psi;
    }

    /// <summary>Child side: runs every program in the batch file and reports on stdout.</summary>
    public static async Task<int> ChildMainAsync(string file, int maxOutput)
    {
        RunnerCulture.Apply();
        var protocol = new StreamWriter(Console.OpenStandardOutput()) { AutoFlush = true };
        var items = JsonSerializer.Deserialize(await File.ReadAllTextAsync(file), CheckJson.Default.ListBatchItem)!;
        for (int i = 0; i < items.Count; i++)
        {
            await protocol.WriteLineAsync(StartMark + i.ToString(System.Globalization.CultureInfo.InvariantCulture));
            var stdout = new System.Text.StringBuilder();
            var r = await SnippetExecutor.RunAsync(items[i].Assembly, items[i].Pdb, items[i].Stdin, new ExecutionLimits(maxOutput), t => stdout.Append(t));
            var record = new RunRecord
            {
                Outcome = r.Outcome,
                Stdout = ProgramBuilder.Normalize(stdout.ToString()),
                Error = r.Error is { } e ? new RunError(e.Type, e.Message, e.Line) : null,
                Ms = r.Milliseconds,
            };
            await protocol.WriteLineAsync(ResultMark + JsonSerializer.Serialize(record, CheckJson.Default.RunRecord));
        }
        return 0;
    }

    /// <summary>Reads the child's stdout line by line, with a timeout per read.</summary>
    private sealed class LineChannel(Process p)
    {
        private readonly System.Threading.Channels.Channel<string> _lines = System.Threading.Channels.Channel.CreateUnbounded<string>();
        public bool Completed { get; private set; }

        public void Start()
        {
            _ = Task.Run(async () =>
            {
                string? line;
                while ((line = await p.StandardOutput.ReadLineAsync()) is not null)
                {
                    // the learner's program may write to stdout directly; only protocol lines matter
                    if (line.StartsWith('\u0001')) await _lines.Writer.WriteAsync(line);
                }
                Completed = true;
                _lines.Writer.TryComplete();
            });
            _ = Task.Run(async () => await p.StandardError.ReadToEndAsync());
        }

        public async Task<string?> ReadAsync(int timeoutMs)
        {
            using var cts = new CancellationTokenSource(timeoutMs);
            try
            {
                return await _lines.Reader.ReadAsync(cts.Token);
            }
            catch (OperationCanceledException)
            {
                return null;
            }
            catch (System.Threading.Channels.ChannelClosedException)
            {
                Completed = true;
                return null;
            }
        }
    }

    private static LineChannel Channel(Process p)
    {
        var c = new LineChannel(p);
        c.Start();
        return c;
    }
}
