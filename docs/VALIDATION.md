# Validation record

Aster 0.2.0, tested 1 October 2026 on the development Windows host with Node.js 24.19.0.

## Completed

- TypeScript typecheck and production renderer/main/preload build.
- 28 automated tests across six files. The original core/storage/provider-mock/protocol coverage includes: wiki link resolution and ambiguity, code exclusion, typed relationships, local suggestions, RAG span coverage and stable IDs, native save/reopen/history, stale/concurrent write rejection, unsafe paths/junctions, move collision and trash, corrupt manifest preservation, provider key boundary and response validation, cross-vault sync batches.
- An isolated session of the packaged Windows executable verifies startup, nested note creation, editing/autosave to an actual Markdown file, wiki links, typed relationships, formatted preview, saved views, filtering, background layout, masked key field, persistence reload, drag-position persistence, external edit conflict recovery, and sandbox/context isolation.
- Added core/storage tests cover bounded YAML and typed metadata, date-only arithmetic across leap days/year/DST boundaries, Aster Query filtering/sorting/limits and rejected syntax, hierarchy cycles/missing parents, a 10,000-note chain, idempotent daily notes, module round-trip and disabling, stale module writes, duplicate IDs, path normalization/traversal rejection, PDF deduplication, source-fingerprint mismatch, annotation geometry validation and corrupt-sidecar preservation.
- The module desktop suite passes against the actual packaged executable. It exercises all three calendar views; daily-note creation; task creation from notes with status/priority/due/project; project-related notes; live Canvas queries with external Markdown changes; additional-filter preservation in the builder; saved card movement/resizing; metadata filters and ancestor context; all five PDF tools; comment editing/deletion/search; undo/redo; annotation navigation; zoom/rotation; and module disable/re-enable.
- A generated three-page PDF includes an intrinsic 90-degree rotation and a nonzero crop-box origin. Checks compare highlight/text positions after zoom and rotation, verify a vertical underline created on a rotated page, and compare exact saved polygon coordinates after closing and relaunching the packaged app. All module records are compared before/after restart.
- A 1,500-note folder added through the filesystem is detected by the running app. The navigator mounts at most 38 rows, scrolls to the last note, then resets to a visible result after filtering. Creating a task from a note also enables a disabled Tasks module.
- Visual inspection of graph, split editor, discovery, Calendar, Projects, Canvas, metadata navigation, and PDF screenshots. A regression check confirms loading PDF styles does not change the file-tree background.
- npm dependency audit reported no known vulnerabilities at install time. This is not a security review or supply-chain guarantee.

## Publication checks

The initial GitHub publication also passed two publication-guard tests, bringing the full automated suite to 30 tests across seven files. The source-file audit and app-archive audit found no matching credential or personal-path findings. Gitleaks 8.30.1 independently scanned the publication file set and the extracted application archive with no findings. These scans do not certify absence of every possible secret or security issue. Synthetic screenshots were visually reviewed. Commit attribution uses a GitHub noreply email.

The distribution is rebuilt from an explicit file allowlist and includes Aster’s MIT license plus dependency notices. Personal vaults, app profiles, keys, test data, logs, source maps, local tools and generated binaries are excluded from source control. Repeatable publication and release checks are included in the GitHub workflows.

The PDF desktop test waits for the viewer to accept pointer input and for Chromium's actual text selection before releasing the drag. This avoids racing asynchronous rendering or saving on the Windows runner; saved annotation counts and geometry are still checked through the real app.

## Reproduce

Run `npm run build`, `npm test`, `npm run test:desktop`, and `npm run test:modules`. Set `ASTER_PACKAGED_EXE` to the absolute path of `release/win-unpacked/Aster.exe` to test the packaged app. Both desktop suites create isolated profiles and use no personal vault or API key. The PDF import test replaces only the native file-picker result to choose its generated fixture; import, rendering, editing and persistence use the actual app APIs and UI.

Windows packaging completed with `npm run package`. The directory build is unsigned and requires its entire `win-unpacked` folder. The module guide replaces the former phased addon roadmap with the implemented feature and query reference.

## Synthetic scale baseline

One run of `node scripts/benchmark.mjs`, using 10,000 short synthetic notes and 9,999 directed wiki edges:

| Work | Time |
| --- | ---: |
| Build link index | 38.2 ms |
| Compute one local suggestion query | 91.6 ms |
| Produce 10,000 RAG chunks | 61.6 ms |

These measure pure core algorithms on this host. They do **not** measure full desktop rendering, disk import, memory under large documents, real retrieval quality, cloud scale, or user-facing latency. The raw benchmark is written to `test-results/benchmark.json`; hardware and corpus variations will change results.

## Not verified

- Real OpenAI/Anthropic calls, billing, account-specific model access or provider outages. Mock responses were used and no real key was supplied.
- PostgreSQL schema execution, sync service integration, encryption protocol, multi-user isolation under a running backend, or cloud load. These are architecture foundations only.
- The PDF corpus does not exhaust malformed/encrypted documents, scanned-page OCR, unusual text rotations, CJK/complex-font combinations, very large documents, or every image codec. Fonts/CMaps/decoders are bundled but that is not comprehensive format certification. Annotated PDF export remains deferred.
- Signed installer/update distribution, macOS/Linux behavior, adversarial filesystem races, abrupt power loss, disk-full recovery, accessibility at all scale factors, external rename reconciliation, or compatibility with third-party plugin systems.

The build is suitable for evaluating the product direction with backed-up local vaults. It is not ready for a large public launch.
