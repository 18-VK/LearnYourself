# Basic explaination - Git and Github

## Git 
Git is a version control system.

In simple words:
Git helps you track changes in your code over time.

What Git does:

- Keeps history of every change
- Lets you go back to older versions
- Allows multiple people to work on the same code
- Helps avoid “my code vs your code” chaos

Git works locally, You can use Git without internet.

## Github

GitHub is a cloud platform that hosts Git repositories.

In simple words:

GitHub is a place on the internet where your Git projects live.

What GitHub adds on top of Git:

- Online backup of your code
- Team collaboration
- Pull Requests (code review)
- Issues (bug tracking)
- Actions (CI/CD automation)

GitHub needs internet, It connects multiple developers using Git.

## How Git and GitHub work together

Typical flow:

- Write code on your laptop
- Git tracks changes
- Commit changes locally
- Push to GitHub
- Others pull your changes
- Review & merge(If require)

# Git config : What is it and why do we need it?

Git configuration is a system that allows you to customize how Git behaves and operates across your system, user account, or individual repositories. 
It uses the git config command to set and manage configuration variables that control everything from user identity to default behaviors and preferences.

## Configuration Levels
Git reads settings from three hierarchical levels, with local taking precedence over global, which in turn overrides system settings:

- Local: Repository-specific settings stored in .git/config within the project directory. 
- Global: User-specific settings applied to all repositories for a given user, stored in ~/.gitconfig (Unix) or C:\Users\<username>\.gitconfig (Windows). 
- System: Machine-wide settings applied to all users and repositories, stored in the system Git installation path (e.g., $(prefix)/etc/gitconfig on Unix, 
          C:\ProgramData\Git\config on Windows).

## Precedence (which wins)

From highest precedence to lowest:

- Command-line options (e.g., git -c key=value ...)
- Environment variables (e.g., GIT_AUTHOR_NAME)
- Local (repository) config (.git/config)
- Global (~/.gitconfig)
- System (/etc/gitconfig)

So a setting in the repo will override the same setting in your global config.

## Why Git needs config at all

Git is not just storing files.
It’s creating a history of changes. Every change (commit) must answer:

- Who made this change?
- How should Git behave while working?
- How should Git talk to remotes and tools?

All of that comes from Git configuration.

Without config, Git would be:

- Anonymous
- Inconsistent
- Hard to automate
- Impossible to use properly in teams

1️⃣ Identity: Who made this change? (MOST IMPORTANT)

When you commit, Git permanently stores:

Author: Aman Kumar <aman@email.com>
Committer: Aman Kumar <aman@email.com>

That comes from:

user.name
user.email

Why this matters

- Shows who wrote the code
- Required for collaboration
- Used by GitHub / GitLab to link commits to your account
- Needed for audit & accountability in companies

❌ Without it:

fatal: unable to auto-detect email address

📌 Real-world example
In a team of 10 developers, when a bug appears:

“Who committed this change?”
Git answers that — because of config.

2️⃣ Different behavior for different projects (Global vs Local)
You don’t work the same way everywhere.

Example: Work vs Personal

- Personal project → personal email
- Office project → company email

That’s why:

- Global config = default behavior
- Local config = project-specific rules

📌 This avoids:

- Leaking company email into public repos
- Mixing identities
- Compliance issues

3️⃣ Consistency & automation (How Git behaves)

Configs control how Git works, not just who you are.

Examples:

- Line endings (Windows vs Linux)
- Merge tools
- Default branch name
- Commit message editor
- Rebase vs merge behavior

4️⃣ Collaboration & safety in teams

Config helps prevent human mistakes.

Examples:

- Push behavior (push.default)
- Pull strategy (pull.rebase)
- Commit signing (GPG)
- Conflict resolution tools

📌 In companies:

Wrong config can break builds
Right config prevents disasters

5️⃣ Productivity (why senior devs care a LOT)

Configs make Git faster and easier.

Examples:

Aliases:

git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.st status


Now:

git st

instead of:

git status

📌 Over months/years → huge time saver

## Git does NOT take a password with user.name and user.email.

What user.name and user.email actually do

git config --global user.name "Aman Kumar"
git config --global user.email "aman@gmail.com"

These are NOT login credentials.

They are only:

- Labels stored inside each commit
- Used for author identification
- Shown in git log, GitHub history, blame, etc.

📌 They are like:

Writing your name on a document, not logging into an account.

## how does GitHub know it’s me?

GitHub does not use user.name or user.email to authenticate you.

Authentication happens ONLY when talking to GitHub

When you run:

git push

GitHub asks:
“Who are you? Prove it.”

That’s where authentication happens — NOT during commit.

## Connect Git to Github account 

Must watch : https://youtu.be/snCP3c7wXw0

1) To connect, need to generate SSH public key of github account..

Recommended: Configure SSH (one-time)

> Generate SSH key (ed25519 recommended):

ssh-keygen -t ed25519 -C "you@example.com"

Note : 
If you are using a legacy system that doesn't support the Ed25519 algorithm, use:

ssh-keygen -t rsa -b 4096 -C "your_email@example.com"

> Now find for id_ed25519.pub file

copy key from file 

2) Add key into github aacount under setting-> SSH and GPG Keys 
