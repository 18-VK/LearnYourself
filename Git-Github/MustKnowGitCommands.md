# Must-Know Git Commands

This is the practical Git command list you should know for real daily work.

---

## 1) Daily workflow commands

### git status
```bash
git status
```
Check what files changed, are staged, or are untracked.

### git add
```bash
git add <file>
git add .
```
Stage files for commit.

### git commit
```bash
git commit -m "message"
```
Save staged changes with a commit message.

### git diff
```bash
git diff
git diff --staged
git diff HEAD
```
View changes before committing.

### git log
```bash
git log --oneline
git log --oneline --graph --decorate --all
```
See recent commit history and branch graph.

---

## 2) Branch commands

### git branch
```bash
git branch
git branch -a
```
List branches.

### Create and switch branch
```bash
git checkout -b feature/my-task
# or
git switch -c feature/my-task
```
Create a new branch and move into it.

### Switch branch
```bash
git switch main
git switch feature/my-task
```
Move between branches.

### Rename branch
```bash
git branch -m old-name new-name
```
Rename the current branch.

### Delete branch
```bash
git branch -d feature/my-task
git branch -D feature/my-task
```
Delete a branch. `-d` is safe, `-D` is force delete.

---

## 3) Remote commands

### git remote
```bash
git remote -v
git remote add origin <url>
git remote remove origin
```
View and manage remotes.

### git fetch
```bash
git fetch origin
```
Download remote updates without changing your current branch.

### git pull
```bash
git pull origin main
```
Download and merge remote changes.

### git push
```bash
git push origin main
git push -u origin feature/my-task
git push
```
Send local commits to the remote repo.

---

## 4) Merge and rebase

### git merge
```bash
git merge main
```
Merge another branch into your current branch.

### git rebase
```bash
git rebase main
```
Replay your commits on top of another branch.

### Conflict handling
```bash
git merge --abort
git rebase --continue
git rebase --abort
```
Abort or continue after resolving conflicts.

---

## 5) Undo and recovery commands

### git restore
```bash
git restore <file>
git restore --staged <file>
```
Discard changes or unstage files.

### git reset
```bash
git reset HEAD <file>
git reset --soft HEAD~1
git reset --mixed HEAD~1
git reset --hard HEAD~1
```
Undo commits or unstage changes.

### git revert
```bash
git revert <commit-hash>
```
Create a new commit that reverses an older one safely.

### git reflog
```bash
git reflog
```
View recent branch and commit movements; useful for recovery.

---

## 6) Stash commands

### git stash
```bash
git stash
git stash list
git stash pop
git stash apply
git stash drop
```
Temporarily save unfinished work and restore it later.

---

## 7) Clean and remove commands

### git rm
```bash
git rm <file>
```
Remove a tracked file from Git.

### git clean
```bash
git clean -fd
git clean -fdx
```
Delete untracked files and folders.

---

## 8) Tagging and release

### git tag
```bash
git tag
git tag v1.0.0
git push origin --tags
```
Create version tags and push them to remote.

---

## 9) History and inspection

### git show
```bash
git show <commit-hash>
git show HEAD
```
View commit details.

### git blame
```bash
git blame <file>
```
See who changed each line in a file.

### git grep
```bash
git grep "text"
```
Search text inside the repository.

---

## 10) Important safety commands

### Force push safely
```bash
git push --force-with-lease
```
Safe way to overwrite remote history after rebase.

### Dangerous force push
```bash
git push --force
```
Use only when absolutely sure.

---

## Best beginner order to learn

Learn these first:

```bash
git status
git add .
git commit -m "message"
git branch
git switch -c feature/my-task
git push -u origin feature/my-task
git fetch
git pull
git merge
git rebase
git restore
git reset --hard HEAD~1
git stash
git log --oneline
```

---

## Minimal real-world workflow

```bash
git status
git add .
git commit -m "Add feature"
git push -u origin feature/my-task
```

When working with teammates:

```bash
git fetch origin
git pull --rebase origin main
git switch feature/my-task
git rebase main
```

If there are conflicts:

```bash
git status
# resolve conflicts

git add <fixed-files>
git rebase --continue
```

### Conflict resolution pathway

Follow this sequence whenever Git reports a conflict:

```bash
# 1. See which files are conflicted
git status

# 2. Open each conflicted file and choose the correct changes
#    Remove the markers: <<<<<<<, =======, >>>>>>>

# 3. Stage each resolved file
git add <fixed-file>

# 4. Continue the operation
git merge --continue       # after a merge
git rebase --continue      # after a rebase

# 5. Check that no conflicts remain
git status
```

If you decide not to continue, cancel the operation safely:

```bash
git merge --abort           # cancel a merge
git rebase --abort          # cancel a rebase
```

After a successful rebase, update the remote branch with:

```bash
git push --force-with-lease
```

---

## Quick summary

If you memorize only these, you’ll be strong in most Git work:

```bash
git status
git add .
git commit -m "message"
git switch -c feature/my-task
git push -u origin feature/my-task
git fetch
git pull
git merge
git rebase
git restore
git reset --hard HEAD~1
git stash
git log --oneline
git push --force-with-lease
```

---

## Final tip

Git becomes easy when you practice the real workflow again and again:

1. edit files
2. check status
3. add files
4. commit
5. push
6. fetch/pull
7. merge/rebase
8. resolve conflicts

That is the daily Git routine.
