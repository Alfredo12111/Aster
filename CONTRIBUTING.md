# Contributing to Aster

Aster is an early desktop knowledge workspace. Useful contributions include focused bug fixes, reproducible issue reports, accessibility improvements, metadata/query fixtures and real-world performance measurements using shareable synthetic data.

## Develop

Follow [Getting started](docs/GETTING-STARTED.md). Keep native filesystem work behind the validated preload API. Markdown remains authoritative. Derived query results must not become a second editable copy of note data. New durable records need validation, stable identity and recovery behavior.

## Before a pull request

- Describe the concrete problem and resulting behavior.
- Update README.md when features change, the relevant module/setup docs, and CHANGELOG.md.
- Run the build and tests relevant to your changes. Desktop behavior should be exercised with an isolated vault.
- Run `npm run audit:publish` and inspect the staged diff.
- Include validation and known limits. Do not claim tests or scale guarantees you have not measured.

Never include personal notes, imported private PDFs, API keys, app profiles, logs, `.env` files, local filesystem paths, credentials or test output. Screenshots must use synthetic sample content. Do not paste credentials into an issue or pull request.

## Maintainer publication workflow

The owner's standing preference is to commit and push completed changes, with the feature page kept current. Repository-specific agent instructions live in [AGENTS.md](AGENTS.md).

For a release, update package version and changelog, build the app, run all three desktop suites against the packaged executable, and run `npm run audit:release`. `npm run release:zip` writes the complete Windows app ZIP and SHA-256 checksum into ignored `artifacts/`. Publish those assets through GitHub Releases, not as source commits. A version tag triggers the release workflow to repeat these checks before publication.

GitHub credentials belong in the operating system credential store or GitHub CLI's secure sign-in. Automated workflows use GitHub's scoped job token. No personal access token or AI provider key is required in this repository.
