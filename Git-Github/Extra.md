# git branch -M vs git branch -m

1. git branch -M 
renames a branch and FORCE overwrites the target name if it already exists.

2. git branch -m
Renames only if target doesn’t exist

Example :
You already have a main branch.

git branch -m main

❌ Fails (Git protects you)

git branch -M main

✅ Works (old main is replaced)

# git push -u vs git push

Core idea (one line) : 

- git push -u → push and remember where to push next time
- git push → push to the already-remembered place

## What does -u actually mean?

-u = --set-upstream

It links:
local branch  →  remote branch

So Git knows:

- where to push
- where to pull from

## Example (first push of a new branch)

git push -u origin feature/login

What happened:
- Branch is created on remote
- Upstream is set

From now on, you can just do:

git push
git pull

## Without -u (annoying case)
git push origin feature/login

Next time:
git push

Git says:

fatal: The current branch has no upstream branch.

## How to check upstream
git branch -vv

You’ll see:

feature/login  abc123 [origin/feature/login] Add login

# git push origin --delete master

It deletes the master branch from the remote repository (origin).

| Part       | Meaning                      |
| ---------- | ---------------------------- |
| `git push` | Send a request to the remote |
| `origin`   | Remote repository            |
| `--delete` | Delete a branch on remote    |
| `master`   | Branch name to delete        |

## Typical real-world use (MOST COMMON)
Rename master → main

git branch -M main
git push -u origin main
git push origin --delete master

Why this is done:

- main is now the default branch
- master is no longer needed
- Avoid confusion & duplicate branches

# How does branches share data?

What happens when you create a feature branch?

Example:

git checkout develop
git checkout -b feature/login

Git creates:

feature/login → pointing to SAME commit as develop

## Important concept 🧠

A branch is just a pointer to a commit, not a folder copy.

Visual
A — B — C   (develop)
          ↑
     feature/login


Both point to commit C.

Same snapshot of:

- files
- folders
- history

## Are files copied?
No.

Git is smart.

It says:

“Both branches are at commit C → they share everything.”
No duplication in storage.

## Then what changes?

When you make a commit in the feature branch:

A — B — C   (develop)
          \
           D — E  (feature/login)


Now:

- develop still at C
- feature has new commits D, E
- Only differences are stored.

You can create hundreds without storage explosion.

# What is the use of Pull request(PR) on remote repo?

## what happens if you DON’T open a PR?

You push:
feature/login

Now it exists on remote.

But:

❌ nobody reviews it
❌ it doesn’t go to main
❌ CI policies might not run
❌ release will not include it
❌ team may not even know it exists

👉 Your work is basically parked.

## Why Pull Requests exist

On platforms like GitHub, a Pull Request is a formal way to say:
“My work is ready. Please review and merge it.”

## What PR unlocks in real companies

1️⃣ Code Review 👀

Other engineers check:

- logic
- design
- naming
- edge cases
- security

This prevents bad code from reaching production.

2️⃣ Automated Checks 🤖

PR usually triggers CI:

- build
- tests
- coverage
- lint
- security scan
- If anything fails → merge blocked.

3️⃣ Discussion 💬

People comment:

- suggest improvements
- ask questions
- request changes
- This improves quality & knowledge sharing.

4️⃣ Approvals ✅

Many repos require:

- 1 or 2 approvals before merge.

5️⃣ Audit Trail 📜

Later you can see:

- who wrote change
- who approved
- why it was done
- Critical for big systems.

## Visual flow
check - GitHub-Pull-request-flow.png file

push branch →
open PR →
CI runs →
review →
approve →
merge

## Why not just push directly to main?

Because that leads to:

🔥 broken builds
🔥 production bugs
🔥 angry teammates
🔥 zero accountability

Most companies block direct pushes.

## What PR tells your team

It signals:

- My feature is complete.
- It is tested.
- Ready for integration.

## Create a PR targeting main:

The developer opens a pull request, specifying their feature branch as the source (or 
head) branch and main as the target (or base) branch. This formally requests that the 
project maintainers "pull" the changes into the main codebase.

# The difference between git clone and git remote add origin + git pull is about how you set up your local repository.

🔹 git clone
Creates a new local repository from scratch.

Copies all files, commit history, and branches from the remote.

Automatically sets the remote origin for you.

Typical first-time command:

git clone https://github.com/username/repo-name.git
👉 Use this when you don’t already have a local repo — it’s the simplest way to get started.

🔹 git remote add origin + git pull
Used when you already have a local repo (maybe you ran git init in a folder).

git remote add origin <url> tells Git where the remote repo lives.

git pull origin main (or whatever branch) fetches changes from that remote into your local repo.

Example:

git init
git remote add origin https://github.com/username/repo-name.git
git pull origin main
👉 Use this if you created a repo locally first and now want to connect it to GitHub.

⚡ Key Difference
git clone = one-step setup (creates repo + sets remote + downloads files).

git remote add origin + git pull = multi-step setup (you already have a repo, then you connect and sync it).

# git show vs git diff

git show is used to display details of a specific commit (author, date, message, and the diff introduced), while git diff is used to compare 
changes between two states (working directory vs. staging, staging vs. last commit, or between commits).

>> Example : 

- git show HEAD
Shows the latest commit details: commit message, author, date, and the exact changes introduced.

- git diff HEAD

📌 Shows:

     All changes (staged + unstaged)
     Compared to last commit

>> Example 2 : 

- git diff HEAD -- App.xaml
Purpose: Compares the current working copy of App.xaml against the version of App.xaml in the latest commit (HEAD).

- git show HEAD -- App.xaml
Purpose: Shows what the latest commit (HEAD) did to the file App.xaml.

