import { chain, src } from '../build';

// sql-server/advanced-queries-and-programmability/ctes › Phase2-ASP.NetAndBackend/SQLTutorial/9.SQL_CTE.md › "## 2️⃣ JOIN / Derived Table Version" (code block 3). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'cte-join-steps', title: 'JOIN / Derived Table Version', source: src('Phase2-ASP.NetAndBackend/SQLTutorial/9.SQL_CTE.md', '## 2️⃣ JOIN / Derived Table Version', 3) },
  [
    { label: 'Step 1', lines: ['Calculate averages once'] },
    { label: 'Step 2', lines: ['Join Employees with averages'] },
    { label: 'Step 3', lines: ['Filter rows'] },
  ],
);
