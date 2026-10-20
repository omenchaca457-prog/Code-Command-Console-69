---
name: Stale workspace declarations
description: Recover when a leaf workspace typecheck disagrees with exports present in a referenced package's source.
---

When a leaf package reports that a workspace export is missing, but the referenced package source already exports it, force-rebuild that package's TypeScript project before changing API definitions or regenerating code.

**Why:** A stale project-reference declaration can keep an artifact typecheck failing even when source exports are current; a forced build resolved this mismatch.

**How to apply:** Confirm the export exists in package source, run `tsc --build <package-path> --force`, then retry the leaf package typecheck.
