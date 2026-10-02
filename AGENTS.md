# Aster contribution instructions

## Standing owner requirements

- Track project changes in this repository and push completed, verified changes to its GitHub origin. This is standing authorization from the owner; do not ask again for ordinary commits and pushes. Do not force-push, discard unrelated edits, or publish secrets.
- Keep the GitHub README feature page, setup guide, and changelog accurate after each product update. Distinguish working features from planned capabilities.
- After every application update, rebuild and verify the owner's local Windows version too. Keep Start Aster.cmd pointing to the updated executable. Preserve all vaults, app profiles, and unsaved work; never replace a running application directory. Confirm the local executable version in the handoff.
- Keep the bundled Pelagic Labs demo and its in-app walkthroughs aligned with working features. First launch may create a fresh demo; updates must never reseed or overwrite an existing demo or personal vault. Refresh synthetic GitHub screenshots when changes affect the demonstrated experience.
- Use Aster's own product identity. Do not use competitor names or comparisons in published project content.
- Keep personal vaults, app profiles, credentials, API keys, logs, local paths, and test output out of Git and release assets. Use synthetic sample content for screenshots. Run the publication audit before committing or publishing a release.
- Aster is a local-first desktop application. Do not imply that cloud sync or production-scale indexing already exists.

## Workflow

1. Read the existing code and preserve unrelated changes.
2. Implement the change and update README.md, relevant docs, and CHANGELOG.md.
3. Run checks appropriate to the change. Application changes require the build and affected automated tests; release candidates also require all five packaged desktop suites, including the real first-launch demo suite.
4. Run `npm run audit:publish`. Inspect the staged diff and filenames. Commit with a clear description and push to the configured remote branch. Use `codex/` for new feature branches; preserve the established main branch for routine owner-authorized updates.
5. Report the commit, push result, validation, and any remaining limitation. If GitHub authentication or permissions block upload, preserve the local commit and ask for secure sign-in; never request a token in chat.
6. For versioned releases, build a clean distribution, audit its app archive, zip the entire application directory, include setup instructions and checksums, and publish only the audited files. Keep generated binaries out of source control.

Repo visibility and licensing are owner decisions. Do not change them based on README language alone.
