using System.Text.Json.Serialization;

namespace LearnYourself.Runner.Check;

/// <summary>One program to check: a lesson block (or several merged blocks) plus its optional harness.</summary>
public sealed record CheckProgram
{
    public required string Id { get; init; }
    public required string Code { get; init; }
    public string? Harness { get; init; }
    public string Stdin { get; init; } = "";
    /// <summary>"on" (skip the semantic exclusions; it must still compile), "off" (never runnable), or null.</summary>
    public string? Force { get; init; }
    public string? ForceReason { get; init; }
}

public sealed record CheckInput
{
    public required List<CheckProgram> Programs { get; init; }
    /// <summary>Execution time limit per run, in milliseconds (the browser uses about 5 s too).</summary>
    public int TimeoutMs { get; init; } = 5000;
    public int MaxOutputChars { get; init; } = 64 * 1024;
}

public sealed record RunRecord
{
    public required string Outcome { get; init; }
    public string Stdout { get; init; } = "";
    public RunError? Error { get; init; }
    public double Ms { get; init; }
}

public sealed record RunError(string Type, string Message, int Line);

public sealed record CheckVerdict
{
    public required string Id { get; init; }
    public required bool Runnable { get; init; }
    public string? Category { get; init; }
    public string? Reason { get; init; }
    public string? Shape { get; init; }
    public bool ReadsInput { get; init; }
    public bool Varies { get; init; }
    public List<string> Assemblies { get; init; } = [];
    public List<CompileDiagnostic> Diagnostics { get; init; } = [];
    public List<RunRecord> Runs { get; init; } = [];
    /// <summary>What the browser should print: set only when both runs agree and the output holds no host data.</summary>
    public RunRecord? Expected { get; init; }
    [JsonIgnore] public byte[]? Assembly { get; init; }
    [JsonIgnore] public byte[]? Pdb { get; init; }
}

public sealed record CheckOutput
{
    public required string Tool { get; init; }
    public required string Sdk { get; init; }
    public required List<string> References { get; init; }
    public required List<CheckVerdict> Programs { get; init; }
}

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase, WriteIndented = false, DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull)]
[JsonSerializable(typeof(CheckInput))]
[JsonSerializable(typeof(CheckOutput))]
[JsonSerializable(typeof(BatchItem))]
[JsonSerializable(typeof(List<BatchItem>))]
[JsonSerializable(typeof(RunRecord))]
internal sealed partial class CheckJson : JsonSerializerContext;

/// <summary>One compiled program handed to the child process that runs it.</summary>
public sealed record BatchItem(string Id, byte[] Assembly, byte[]? Pdb, string Stdin);
