# Branching, Upstream Tracking, and Pull Requests

This file covers advanced but commonly used Git concepts in real team workflows.

---

## 1. `git branch -m` vs `git branch -M`

### `git branch -m`

Rename the current branch.

```bash
git branch -m new-name
```

### `git branch -M`

Rename the current branch and force overwrite if another branch already has that name.

```bash
git branch -M main
```

### Example

```bash
git branch -m feature/login
```

If `feature/login` already exists, Git may reject it without `-M`.

---

## 2. `git push -u` vs `git push`

### `git push -u origin <branch>`

Push a branch to the remote and set its upstream tracking.

```bash
git push -u origin feature/login
```

After that, you can use:

```bash
git push
git pull
```

### `git push`

Push to the branch already tracked upstream.

```bash
git push
```

### Check upstream tracking

```bash
git branch -vv
```

This shows which remote branch your local branch is tracking.

---

## 3. Delete remote branch

### Command

```bash
git push origin --delete master
```

### Typical use

```bash
git branch -M main
git push -u origin main
git push origin --delete master
```

This is a common branch cleanup workflow after renaming `master` to `main`.

---

## 4. How branches share data

A branch is a pointer to a commit, not a full folder copy.

### Example

```text
A --- B --- C  (main)
             \
              D --- E (feature/login)
```

Both branches share the same base commit until new commits are created. Git stores only the differences.

---

## 5. Why pull requests exist

A pull request is a formal request to merge one branch into another.

### Benefits

- review code before merge
- run automated tests and CI
- discuss fixes and improvements
- enforce approvals
- improve accountability

### Typical flow

```text
push branch -> open PR -> CI runs -> review -> approve -> merge
```

### Why not push directly to main?

Direct pushes can lead to:
- broken builds
- production bugs
- poor review process
- less team accountability

---

## 6. GitHub pull request workflow

```bash
git switch -c feature/login
git add .
git commit -m "Add login feature"
git push -u origin feature/login
```

Then:
1. open a PR on GitHub
2. select the base branch (`main`)
3. review and approve
4. merge the PR
5. delete the feature branch if needed

---

## 7. Example of multiple remotes

```bash
origin    -> your fork
upstream  -> official repository
```

### Typical commands

```bash
git fetch upstream
git diff main upstream/main
git merge upstream/main
git push origin feature/login
```

### Meaning
- `main` = local branch
- `origin/main` = your fork
- `upstream/main` = official project repo

---

## 8. Branch lifecycle

### Create feature branch

```bash
git switch -c feature/login
```

### Make changes

```bash
git add .
git commit -m "Add login flow"
```

### Push branch

```bash
git push -u origin feature/login
```

### Merge branch after review

```bash
git switch main
git merge feature/login
```

### Delete branch

```bash
git branch -d feature/login
```

---

## 9. Safe delete vs force delete

### Safe delete

```bash
git branch -d feature/login
```

Only works if the branch is already merged.

### Force delete

```bash
git branch -D feature/login
```

Deletes even if not merged. Use only when you are sure it is safe.

---

## 10. Quick summary

```bash
git branch -m new-name
git push -u origin feature/login
git branch -d feature/login
git push origin --delete feature/login
git diff main upstream/main
```

These are the main commands used in clean feature-branch workflows and open-source/team collaboration.

