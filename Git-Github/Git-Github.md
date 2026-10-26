# Git and GitHub Explained

This file explains what Git is, how GitHub fits into the workflow, and why Git configuration matters.

---

## 1. What is Git?

Git is a distributed version control system.

It helps you:
- track code changes over time
- go back to earlier versions
- work with others without overwriting each other’s code
- review history and debug issues

### In simple words
Git keeps a history of your project and lets you move between versions safely.

---

## 2. What is GitHub?

GitHub is a hosting platform for Git repositories.

It adds:
- online backups of your repo
- pull requests
- code review
- issue tracking
- CI/CD workflows
- collaboration across teams

### In simple words
Git keeps your project history locally. GitHub stores and shares that history online.

---

## 3. How Git and GitHub work together

Typical flow:

```text
Write code -> git add -> git commit -> git push -> GitHub -> review -> merge
```

### Real-world example

- create a feature branch
- make code changes
- commit locally
- push to GitHub
- open a pull request
- merge after review

---

## 4. Why Git configuration matters

Git needs configuration to know:
- who you are
- how to handle line endings
- which editor to open for commit messages
- how your repos should behave

### Configuration levels

Git reads settings in this order:

1. command-line arguments
2. environment variables
3. local repo config
4. global config
5. system config

### Example

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

---

## 5. Identity and commit metadata

Every commit stores author information.

Example:

```text
Author: Aman Kumar <aman@email.com>
Committer: Aman Kumar <aman@email.com>
```

This matters because:
- teammates know who changed code
- GitHub links commits to you
- audit and debugging become easier

### Without identity

Git may show:

```bash
fatal: unable to auto-detect email address
```

---

## 6. Global vs local config

### Global config
Applies to all repositories on your machine.

```bash
git config --global user.name "Your Name"
```

### Local config
Applies only to one repository.

```bash
git config user.name "Office Name"
```

### Why both exist

You may want different identity settings for:
- personal projects
- company projects
- public vs private repos

---

## 7. Git config examples

### Set editor

```bash
git config --global core.editor "code --wait"
```

### Set line endings

```bash
git config --global core.autocrlf true
```

### Create aliases

```bash
git config --global alias.st status
git config --global alias.br branch
```

---

## 8. GitHub authentication

`user.name` and `user.email` do not log you into GitHub.

GitHub authenticates you only when you connect for remote operations like:

```bash
git push
```

### Common authentication methods
- HTTPS with username/password or token
- SSH key

---

## 9. SSH setup for GitHub

### Generate SSH key

```bash
ssh-keygen -t ed25519 -C "you@example.com"
```

### Alternative for older systems

```bash
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"
```

### Add key to GitHub

1. open the generated `.pub` file
2. copy the key
3. go to GitHub → Settings → SSH and GPG keys
4. paste and save

Then you can push without entering a password repeatedly.

---

## 10. Practical GitHub workflow

```bash
git switch -c feature/login
git add .
git commit -m "Add login screen"
git push -u origin feature/login
```

Then:
- open a pull request
- review changes
- merge after approval

---

## 11. Git pager navigation

When Git output opens in a pager, such as with `git log` or `git diff`, use:

```text
b  -> go back one page
d  -> move to the next section/page
q  -> quit and exit
```

Other useful keys:

```text
f  -> move forward one full page
Space -> move forward one page
↑ / ↓ -> move one line
```

---

## 12. Summary

Git is the version control engine. GitHub is the online collaboration platform built around Git.

Without proper Git config:
- commit metadata is wrong
- editor behavior is confusing
- collaboration becomes messy
- remote pushes may fail

The most important config values to remember are:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
git config --global core.editor "code --wait"
```

This basic setup is enough to work cleanly in most repos.
