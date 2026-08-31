# Release Notes Template

When cutting a release, copy this template into a new file at `docs/releases/vX.Y.Z.md` and fill in the highlights **before** pushing the tag. CI will append the generated changelog section automatically.

---

## 🚀 Highlights — vX.Y.Z (YYYY-MM-DD)

> A short, human-readable summary of what this release means for users and contributors. Keep it to 3–5 bullet points; save the raw commit log for the generated section below.

- **Feature name**: One sentence describing the user-visible benefit.
- **Performance improvement**: Describe the measurable gain (e.g., "dashboard load time reduced from 4 s to <2 s via Redis caching").
- **Bug fix**: What was broken, what broke it, and how it's fixed.
- **Breaking change** ⚠️: What callers must update and why.
- **Dependency update**: Notable library bumps and their impact.

### Upgrade notes

List any manual migration steps, env-var changes, or configuration updates required.

---

*The full commit-by-commit changelog follows in the auto-generated section appended by CI.*
