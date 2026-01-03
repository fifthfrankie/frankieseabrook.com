---
title: "Git Workflow Tips That Actually Save Time"
description: "Practical Git commands and workflows I use daily to work more efficiently. Interactive rebase, fixup commits, and more."
date: 2024-03-05
tags: ["git", "productivity", "tools"]
---

After years of using Git, I've accumulated a collection of commands and workflows that genuinely save time. These aren't obscure tricks - they're practical techniques I use almost every day.

## Amend Without Editing the Message

Forgot to add a file to your last commit? Don't create a new commit:

```bash
git add forgotten-file.ts
git commit --amend --no-edit
```

The `--no-edit` flag keeps your existing commit message. Quick and clean.

## Fixup Commits for Clean History

When you find a bug in an earlier commit during code review, use fixup commits:

```bash
# Find the commit hash you want to fix
git log --oneline

# Create a fixup commit
git add .
git commit --fixup=abc1234

# Later, squash fixups into their targets
git rebase -i --autosquash main
```

The `--autosquash` flag automatically marks fixup commits to be squashed into their targets. Your reviewer sees clean, logical commits instead of "fix typo" and "oops forgot this" messages.

## Stash With a Message

Don't lose track of what you stashed:

```bash
git stash push -m "WIP: user authentication refactor"
git stash list
# stash@{0}: On main: WIP: user authentication refactor
```

Much better than the default "WIP on main: abc1234" message.

## Checkout Files from Another Branch

Need just one file from another branch without switching?

```bash
# Get a specific file from another branch
git checkout feature-branch -- src/utils/helpers.ts

# Or from a specific commit
git checkout abc1234 -- src/components/Button.tsx
```

## Interactive Add for Partial Commits

When you've made multiple unrelated changes and want to commit them separately:

```bash
git add -p
```

Git will walk you through each change, letting you stage individual hunks. Use `y` to stage, `n` to skip, or `s` to split a hunk into smaller pieces.

## Find When Something Broke

Binary search through commits to find when a bug was introduced:

```bash
git bisect start
git bisect bad          # Current commit is broken
git bisect good v1.0.0  # This tag was working

# Git checks out a commit in the middle
# Test it, then mark it:
git bisect good  # or git bisect bad

# Repeat until Git finds the culprit
git bisect reset  # Return to original state
```

## Aliases That Pay Off

Add these to your `~/.gitconfig`:

```ini
[alias]
    # Short status
    s = status -sb

    # Pretty log
    lg = log --oneline --graph --decorate -20

    # Show what you're about to push
    unpushed = log @{u}.. --oneline

    # Undo last commit, keeping changes staged
    uncommit = reset --soft HEAD~1

    # Clean up merged branches
    cleanup = "!git branch --merged | grep -v '\\*\\|main\\|master' | xargs -n 1 git branch -d"
```

Usage:

```bash
git s               # Quick status
git lg              # Visual history
git unpushed        # See commits not yet pushed
git uncommit        # Undo last commit
git cleanup         # Delete merged branches
```

## Better Diff Output

Show word-level changes instead of line-level:

```bash
git diff --word-diff
```

For code, this is often much easier to read than traditional line diffs.

## Recover Deleted Commits

Accidentally reset or rebased away commits? They're not gone:

```bash
git reflog
# Find the commit hash before your mistake
git reset --hard abc1234
```

Git keeps all commits for at least 30 days, even if no branch points to them. The reflog is your safety net.

## Pull With Rebase by Default

Avoid unnecessary merge commits:

```bash
# One time
git pull --rebase

# Or set it globally
git config --global pull.rebase true
```

Your history stays linear, and you avoid those "Merge branch 'main' into main" commits.

## Wrapping Up

These aren't all the Git commands you'll ever need, but they're the ones that have saved me the most time. Start with one or two that seem useful, and gradually incorporate more into your workflow.

The best Git workflow is the one you actually use consistently. Pick what works for you.
