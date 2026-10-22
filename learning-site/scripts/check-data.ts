/**
 * Fast re-check of the hand-edited data (src/data/quizzes, cheatsheets, interview) — `npm run data:check`.
 *
 * Uses the lesson context saved by the last content run (src/data/generated/data-context.json), so it takes
 * seconds instead of re-running the whole pipeline. Run `npm run content` first if notes or manifests changed.
 * Writes nothing unless --write is given (then it refreshes the resolved JSON in src/data/generated/).
 *   npm run data:check                       all data
 *   npm run data:check -- --only quizzes     only lines mentioning quizzes (also: cheatsheets, interview)
 */
import fs from 'node:fs';
import path from 'node:path';
import { checkData, type LessonRecord } from './lib/data-check';
import { OUT_DATA } from './lib/paths';

const ctxFile = path.join(OUT_DATA, 'data-context.json');
if (!fs.existsSync(ctxFile)) {
  console.error('No src/data/generated/data-context.json yet: run `npm run content` once first.');
  process.exit(2);
}
const raw = JSON.parse(fs.readFileSync(ctxFile, 'utf8')) as {
  lessons: LessonRecord[];
  sheetIds: { id: string; title: string }[];
  topics: { id: string; title: string; subtopics?: string[]; notCoveredYet?: boolean }[];
  interviewSlices: { rel: string; start: number; end: number }[];
  omitted: Record<string, number[]>;
  falsePositives: string[];
};
const errors: string[] = [];
const warnings: string[] = [];
const result = checkData({
  ...raw,
  omitted: new Map(Object.entries(raw.omitted).map(([k, v]) => [k, new Set(v)])),
  falsePositives: new Set(raw.falsePositives),
  errors,
  warnings,
});
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : undefined;
const pick = (l: string[]) => (only ? l.filter((x) => x.includes(only)) : l);
for (const w of pick(warnings)) console.warn(`warning: ${w}`);
for (const e of pick(errors)) console.error(`ERROR: ${e}`);
const s = result.summary;
console.log(
  `quizzes: ${s.quizzes.lessons} lessons, ${s.quizzes.questions} questions (${s.quizzes.missing.length} teaching lessons without one)\n` +
    `cheat sheets: ${s.cheatsheets.sheets} (${s.cheatsheets.items} items, ${s.cheatsheets.fromDocs} from docs; missing ${s.cheatsheets.missing.join(', ') || 'none'})\n` +
    `interview: ${s.interview.map((t) => `${t.topic} ${t.notes}n/${t.web}w`).join(', ')}`,
);
if (process.argv.includes('--write') && errors.length === 0) {
  for (const [name, value] of Object.entries(result.outputs)) fs.writeFileSync(path.join(OUT_DATA, name), JSON.stringify(value, null, 1));
  console.log('resolved data written to src/data/generated/');
}
console.log(errors.length ? `${errors.length} error(s)` : 'data OK');
process.exit(errors.length ? 1 : 0);
