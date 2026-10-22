using System.Globalization;
using System.Text;

namespace LearnYourself.Runner;

/// <summary>
/// A tiny JSON writer for the worker protocol and the check's output. Hand-written so the browser bundle does not
/// need System.Text.Json (and its reflection metadata) just to report a handful of fields.
/// </summary>
public sealed class Json
{
    private readonly StringBuilder _sb = new();
    private bool _needComma;

    public override string ToString() => _sb.ToString();

    public Json Begin() { Sep(); _sb.Append('{'); _needComma = false; return this; }
    public Json End() { _sb.Append('}'); _needComma = true; return this; }
    public Json BeginArray(string name) { Name(name); _sb.Append('['); _needComma = false; return this; }
    public Json BeginArray() { Sep(); _sb.Append('['); _needComma = false; return this; }
    public Json EndArray() { _sb.Append(']'); _needComma = true; return this; }
    public Json BeginObject(string name) { Name(name); _sb.Append('{'); _needComma = false; return this; }

    public Json Prop(string name, string? value) { Name(name); Str(value); return this; }
    public Json Prop(string name, bool value) { Name(name); _sb.Append(value ? "true" : "false"); _needComma = true; return this; }
    public Json Prop(string name, int value) { Name(name); _sb.Append(value.ToString(CultureInfo.InvariantCulture)); _needComma = true; return this; }
    public Json Prop(string name, double value) { Name(name); _sb.Append(Math.Round(value, 1).ToString(CultureInfo.InvariantCulture)); _needComma = true; return this; }
    public Json Value(string? value) { Sep(); Str(value); return this; }

    private void Name(string name) { Sep(); Str(name); _sb.Append(':'); _needComma = false; }
    private void Sep() { if (_needComma) _sb.Append(','); }

    private void Str(string? s)
    {
        if (s is null) { _sb.Append("null"); _needComma = true; return; }
        _sb.Append('"');
        foreach (var c in s)
        {
            switch (c)
            {
                case '"': _sb.Append("\\\""); break;
                case '\\': _sb.Append("\\\\"); break;
                case '\n': _sb.Append("\\n"); break;
                case '\r': _sb.Append("\\r"); break;
                case '\t': _sb.Append("\\t"); break;
                default:
                    if (c < 0x20 || c == (char)0x2028 || c == (char)0x2029) _sb.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                    else _sb.Append(c);
                    break;
            }
        }
        _sb.Append('"');
        _needComma = true;
    }

    public static void WriteDiagnostics(Json j, IEnumerable<CompileDiagnostic> diagnostics)
    {
        j.BeginArray("diagnostics");
        foreach (var d in diagnostics)
        {
            j.Begin().Prop("id", d.Id).Prop("severity", d.Severity).Prop("message", d.Message).Prop("file", d.File)
                .Prop("line", d.Line).Prop("column", d.Column).Prop("endLine", d.EndLine).Prop("endColumn", d.EndColumn).End();
        }
        j.EndArray();
    }

    public static void WriteRun(Json j, RunResult r)
    {
        j.BeginObject("run").Prop("outcome", r.Outcome).Prop("exitCode", r.ExitCode).Prop("truncated", r.OutputTruncated).Prop("ms", r.Milliseconds);
        if (r.Error is { } e)
        {
            j.BeginObject("error").Prop("type", e.Type).Prop("message", e.Message).Prop("file", e.File).Prop("line", e.Line).BeginArray("stack");
            foreach (var s in e.Stack) j.Begin().Prop("method", s.Method).Prop("file", s.File).Prop("line", s.Line).End();
            j.EndArray().End();
        }
        j.End();
    }
}
