# Git Cleanup Guide - Removing Build Artifacts

## Problem
The `target/` directory (89+ MB) was accidentally committed to Git. This directory contains Rust build artifacts that should never be in version control.

## Solution Applied

### 1. Created .gitignore Files
Added `.gitignore` files to prevent future commits of build artifacts:

**Root `.gitignore`:**
- Ignores `**/target/` (all target directories)
- Ignores `**/Cargo.lock` (lock files for libraries)
- Ignores IDE files, OS files, and other temporary files

**Stellar-Save/.gitignore:**
- Project-specific ignore rules

### 2. Removed from Git Tracking
```bash
git rm -r --cached contracts/guess-the-number/target/
git rm --cached contracts/guess-the-number/Cargo.lock
```

This removes the files from Git tracking but keeps them on your local filesystem.

### 3. Commit the Changes
```bash
cd Stellar-Save
git add .gitignore
git commit -m "Remove build artifacts and add .gitignore

- Remove target/ directory from version control
- Remove Cargo.lock (library project)
- Add comprehensive .gitignore for Rust projects"
```

### 4. Push to GitHub
```bash
git push origin main
```

## What Should NEVER Be Committed

### Rust Projects:
- ❌ `target/` - Build artifacts (can be 100s of MB)
- ❌ `Cargo.lock` - For library projects (OK for binaries)
- ❌ `*.wasm` - Compiled WebAssembly files
- ❌ `*.rlib` - Rust library files

### General:
- ❌ IDE files (`.vscode/`, `.idea/`)
- ❌ OS files (`.DS_Store`, `Thumbs.db`)
- ❌ Environment files (`.env`)
- ❌ Coverage reports
- ❌ Log files

## What SHOULD Be Committed

### Rust Projects:
- ✅ `src/` - Source code
- ✅ `Cargo.toml` - Project configuration
- ✅ `Cargo.lock` - For binary/application projects only
- ✅ `README.md` - Documentation
- ✅ Tests and test data
- ✅ `.gitignore` - Ignore rules

## Why This Matters

1. **Repository Size**: Build artifacts can make repos huge (100s of MB)
2. **GitHub Limits**: Files over 50 MB trigger warnings, over 100 MB are rejected
3. **Collaboration**: Other developers don't need your build artifacts
4. **CI/CD**: Build systems generate their own artifacts
5. **Security**: Build artifacts may contain sensitive information

## Rebuilding After Clone

When someone clones your repo, they just run:
```bash
cargo build          # Debug build
cargo build --release # Release build
cargo test           # Run tests
```

The `target/` directory is automatically created with fresh builds.

## Verification

Check what's being tracked:
```bash
git ls-files | grep target/
# Should return nothing

git ls-files | grep Cargo.lock
# Should only show Cargo.lock for binary projects
```

Check ignore is working:
```bash
git status
# target/ should not appear in untracked files
```

## Future Prevention

Before committing, always:
1. Check `git status` for large files
2. Review what's being added with `git add -p`
3. Use `git diff --cached` before committing
4. Keep `.gitignore` up to date

## Additional Resources

- [Rust .gitignore template](https://github.com/github/gitignore/blob/main/Rust.gitignore)
- [GitHub file size limits](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github)
- [Git LFS](https://git-lfs.github.com/) - For truly large files that must be versioned
