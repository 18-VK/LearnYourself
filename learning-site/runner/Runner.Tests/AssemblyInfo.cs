using Xunit.Sdk;
using Xunit.v3;

// SnippetExecutor redirects Console, which belongs to the whole process, so a process can only run one program at a
// time. The site keeps to that: the browser queues its runs, and Runner.Check gives each batch its own child process.
// These tests all share one process, so they must run one at a time too, or a program's output lands in another test.
[assembly: Parallelization(Mode = ParallelMode.None)]
