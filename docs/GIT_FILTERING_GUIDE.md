# Git Filtering Guide: Purging `inbox/` and `external-inbox/` from History

The `inbox/` and `external-inbox/` directories are used for local data ingestion and are **gitignored** — their contents should never be committed. If files from these directories were previously committed, follow the steps below to scrub them from the repository's full git history.

---

## Why This Is Needed

- `inbox/` and `external-inbox/` contain personal data, raw research files, and other content that should remain local only.
- These paths are now listed in `.gitignore` to prevent future commits.
- Any files that were committed in the past must be explicitly removed from git history using `git filter-repo`.

---

## Prerequisites

Install `git-filter-repo` (a fast, safe replacement for `git filter-branch`):

```bash
pip install git-filter-repo
# or on macOS:
brew install git-filter-repo
```

---

## Steps to Purge the Directories from Git History

> ⚠️ This rewrites history. All collaborators must re-clone or reset after this operation.

### 1. Make a fresh backup clone

```bash
git clone --mirror https://github.com/RSBalchII/anchor-engine-node.git anchor-engine-node-backup
```

### 2. Run `git filter-repo` to remove the paths

In your local working copy of the repository:

```bash
git filter-repo --path inbox/ --path external-inbox/ --invert-paths
```

This rewrites history to remove the specified paths from all commits across every branch and tag. The commits themselves are preserved, but any changes touching these paths are stripped out.

### 3. Verify the paths are gone

```bash
git log --all --full-history -- inbox/ external-inbox/
# Should return no results
```

### 4. Force-push the rewritten history

```bash
git push origin --force --all
git push origin --force --tags
```

### 5. Notify all collaborators

Everyone who has cloned the repo must run:

```bash
git fetch origin
git reset --hard origin/main   # or the relevant branch
```

Or simply re-clone the repository fresh.

---

## Ongoing Protection

The following entries in `.gitignore` prevent these directories from ever being committed again:

```gitignore
external-inbox/*
inbox/*
```

The `/*` suffix ignores all **files and subdirectories** inside each directory, while still allowing git to track the directory itself (via `.gitkeep`). This is intentional — it keeps the empty directory structure in the repo for tooling that expects it, while preventing any content from being committed.
