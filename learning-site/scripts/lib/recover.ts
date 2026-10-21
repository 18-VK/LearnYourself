/**
 * Unfenced-code recovery for notes that write C#, XAML, SQL or shell commands as plain text.
 *
 * Plain Markdown turns unfenced XAML into raw HTML (which disappears from the page) and joins C# lines
 * into one paragraph. For the notes listed under `recoverUnfencedCode` in _site.yaml, runs of code-like
 * lines are wrapped in fences. Nothing is removed: a lone language label line ("xml") directly above a
 * run becomes the fence's language. Every recovered block is reported in the coverage report.
 */

export interface RecoveredBlock {
  /** 0-based first and last line (inclusive) of the code run */
  start: number;
  end: number;
  lang: string;
  /** 0-based line of a language label absorbed into the fence, if any */
  labelLine?: number;
}

const XAML_TAG = /^\s*<\/?[A-Za-z][\w.:-]*(\s|>|\/>|$)/;
const XAML_COMMENT = /^\s*<!--.*-->\s*$/;
const XAML_ATTR_CONT = /^\s+[\w.:-]+\s*=\s*["{]/;
const XAML_CLOSE = /^\s*\/?>\s*$/;
const CS_DECL =
  /^\s*(public|private|protected|internal|static|readonly|sealed|abstract|override|virtual|async|await|class|interface|struct|enum|record|namespace|using|var|new|return|if|else|for|foreach|while|do|switch|case|default:|try|catch|finally|throw|get|set|this\.|base\.|void|int|string|bool|double|decimal|float|long|object|dynamic)\b/;
const CS_STATEMENT = /^\s*[A-Za-z_][\w.<>,\[\]? ]*(\(.*\)|\s*=[^=].*|\+\+|--)\s*;\s*(\/\/.*)?$/;
const CS_ENDS = /;\s*(\/\/.*)?$/;
const CS_BRACE = /^\s*[{}]\s*[;),]*\s*$/;
const CS_COMMENT = /^\s*\/\//;
const CS_ATTRIBUTE = /^\s*\[[A-Z]\w*(\(.*\))?\]\s*$/;
const CS_HANDLER = /^\s*[A-Za-z_][\w.]*\s*\+?=\s*[A-Za-z_][\w.]*\s*;?\s*$/;
const SQL_LINE =
  /^\s*(CREATE|ALTER|DROP|SELECT|INSERT|UPDATE|DELETE|EXEC|EXECUTE|DECLARE|SET|BEGIN|END|IF|ELSE|WHILE|FROM|WHERE|JOIN|INNER|LEFT|RIGHT|GROUP BY|ORDER BY|HAVING|VALUES|RETURN|AS|GO|PRINT|WITH|UNION|OUTPUT|CASE|WHEN|THEN|TOP|AND|OR)\b(?![a-z])/;
const SQL_PARAM = /^\s*@\w+\s+[A-Z]/;
/** `-- comment`, but not a row of dashes (a Markdown rule or setext underline). */
const SQL_COMMENT = /^\s*--(?!-*\s*$)/;
const CS_OPENER = /[\w)\]>"]\s*(=>\s*)?\{\s*$/;
const SHELL = /^\s*(dotnet|npm|git|cd|mkdir)\s+\S/;
const LANG_LABEL = /^\s*(xml|xaml|csharp|c#|cs|sql|tsql|json|bash|powershell)\s*$/i;

const MARKDOWN_BLOCK = /^\s*([-*+]\s|\d+[.)]\s|>|\||#{1,6}\s)/;

type Kind = 'xaml' | 'csharp' | 'sql' | 'shell' | null;

function classify(line: string): Kind {
  if (!line.trim() || MARKDOWN_BLOCK.test(line)) return null;
  if (XAML_TAG.test(line) || XAML_COMMENT.test(line)) return 'xaml';
  if (SQL_COMMENT.test(line) || SQL_PARAM.test(line) || SQL_LINE.test(line)) return 'sql';
  if (SHELL.test(line)) return 'shell';
  if (CS_COMMENT.test(line) || CS_BRACE.test(line) || CS_ATTRIBUTE.test(line)) return 'csharp';
  if (CS_DECL.test(line) && (/[;{}()=]/.test(line) || /\b(class|interface|struct|enum|record|namespace)\s+[A-Z]/.test(line))) return 'csharp';
  if (CS_OPENER.test(line) && /[(.=]/.test(line) && !/[.!?]\s*\{?\s*$/.test(line.replace(/\{\s*$/, ''))) return 'csharp';
  if (CS_STATEMENT.test(line) || (CS_ENDS.test(line) && /[=(]/.test(line) && !/\s{2,}\S+\s\S+\s\S+.*\.$/.test(line))) return 'csharp';
  if (CS_HANDLER.test(line) && /\+=/.test(line)) return 'csharp';
  return null;
}

/** A line that continues an already-open run even though it would not start one. */
function continues(line: string, kind: Exclude<Kind, null>, depth: number): boolean {
  if (!line.trim() || MARKDOWN_BLOCK.test(line)) return false;
  if (kind === 'xaml') return XAML_ATTR_CONT.test(line) || XAML_CLOSE.test(line) || XAML_TAG.test(line) || /^\s+.*(\/>|>)\s*$/.test(line);
  if (kind === 'csharp') return depth > 0 || /^\s{2,}\S/.test(line) || classify(line) === 'csharp';
  if (kind === 'sql') return /^\s{2,}\S/.test(line) || classify(line) === 'sql' || /^\s*\)?\s*;?\s*$/.test(line);
  return classify(line) === 'shell';
}

const braceDelta = (line: string) => {
  const code = line.replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/\/\/.*$/, '');
  return (code.match(/[{(]/g) ?? []).length - (code.match(/[})]/g) ?? []).length;
};

/** Open XAML elements after this line: `<Tag …>` opens, `</Tag>` and `/>` close, comments ignored. */
const tagDelta = (line: string) => {
  const code = line.replace(/<!--.*?-->/g, '').replace(/"[^"]*"/g, '""');
  return (code.match(/<[A-Za-z]/g) ?? []).length - (code.match(/<\//g) ?? []).length - (code.match(/\/>/g) ?? []).length;
};

const LANG_OF: Record<Exclude<Kind, null>, string> = { xaml: 'xml', csharp: 'csharp', sql: 'sql', shell: 'bash' };

/** Finds runs of unfenced code. `skip[i]` marks lines that must not be touched (existing fences, omitted lines). */
export function findUnfencedCode(lines: readonly string[], skip: readonly boolean[]): RecoveredBlock[] {
  const blocks: RecoveredBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const kind = skip[i] ? null : classify(lines[i]!);
    if (!kind) {
      i++;
      continue;
    }
    const start = i;
    let end = i;
    const delta = (line: string) => (kind === 'csharp' ? braceDelta(line) : kind === 'xaml' ? tagDelta(line) : 0);
    let depth = Math.max(0, delta(lines[i]!));
    let j = i + 1;
    while (j < lines.length && !skip[j]) {
      const line = lines[j]!;
      if (!line.trim()) {
        // allow a single blank line inside a run when the next line clearly continues it
        const next = lines[j + 1];
        const nextIndented = next !== undefined && /^ {4,}\S/.test(lines[start]!) && /^ {4,}\S/.test(next);
        if (next !== undefined && !skip[j + 1] && (depth > 0 || classify(next) === kind || nextIndented)) {
          j++;
          continue;
        }
        break;
      }
      const k = classify(line);
      // inside an open XAML element or C# block, any non-Markdown line belongs to the run
      // (only indented or tag/brace-led lines, so an unclosed shorthand tag like <SaveButto> can't swallow prose)
      const insideOpen = depth > 0 && !MARKDOWN_BLOCK.test(line) && (kind === 'xaml' || kind === 'csharp') && /^(\s|[<{}])/.test(line);
      // a run that starts indented by 4+ spaces is one Markdown indented-code region: keep it whole
      const indentedRegion = /^ {4,}\S/.test(lines[start]!) && /^ {4,}\S/.test(line);
      if (k === kind || insideOpen || indentedRegion || continues(line, kind, depth) || (kind === 'csharp' && k === 'xaml' && depth > 0)) {
        depth = Math.max(0, depth + delta(line));
        end = j;
        j++;
        continue;
      }
      break;
    }
    const block: RecoveredBlock = { start, end, lang: LANG_OF[kind] };
    const prev = start - 1;
    if (prev >= 0 && !skip[prev] && LANG_LABEL.test(lines[prev]!)) {
      block.labelLine = prev;
      const label = lines[prev]!.trim().toLowerCase();
      block.lang = label === 'c#' || label === 'cs' ? 'csharp' : label === 'xaml' ? 'xml' : label === 'tsql' ? 'sql' : label;
    }
    blocks.push(block);
    i = end + 1;
  }
  return blocks;
}
