# Aster product direction

The first audience is people building substantial, connected knowledge bases for RAG systems and people who think spatially. The writing experience stays familiar: local folders, plain Markdown, wiki links, backlinks and a readable preview. The differentiation should come from making a knowledge base easier to curate, inspect and reuse.

## What this alpha establishes

- Vault folders, note creation, nested file tree, content search, Markdown editing and preview.
- Derived wiki-link graph plus labeled, directed relationships.
- Persistent manual positions, folder/note colors, saved filtered views, clustered/radial/force arrangements.
- Explainable on-device candidate suggestions and opt-in BYOK AI review.
- Source-attributed RAG chunks that retain revision and relationship information.
- Ordinary files, revision conflict checks, historical snapshots and recoverable trash.
- Optional Calendar and Tasks & Projects with source-note links and dated-note organization.
- PDF text/region/ink annotation, searchable annotation navigation and durable page coordinates.
- Live Aster Query Canvas cards and virtualized folder/frontmatter hierarchy navigation.

## The differentiators worth testing

| Idea | User benefit | Evidence needed before expanding |
| --- | --- | --- |
| **Evidence-backed relationships** | “Supports” links point to a passage, citation and source revision; users can inspect why a connection exists. | Can users verify an answer or curate a dataset faster? |
| **Knowledge quality lenses** | Highlight ungrounded claims, contradictory evidence, isolated sources, missing citations and stale embeddings. | Which signals predict retrieval/answer failures? |
| **RAG workbench** | Preview chunk boundaries, compare retrieval strategies and keep a reusable question/evidence evaluation set. | Measured retrieval recall and citation correctness improve. |
| **Spatial views as reusable retrieval scopes** | A curated neighborhood becomes a named, exportable context collection. Pin geometry without changing note content. | Users return to saved contexts; exports preserve their intent. |
| **Reviewable AI suggestions** | Explain suggested edges, show evidence, accept/reject in batches, remember rejections and undo changes. | Useful accepted suggestions without contaminating the graph. |
| **Stable source ingestion** | Import PDFs/web pages with source spans and revision history; update a source without orphaning every chunk. | Source updates keep references and evaluations valid. |

These are product hypotheses to validate with real research workflows. The priority is reliable knowledge curation, clear source evidence, and useful retrieval.

## Further product work

The requested built-in Calendar, Tasks & Projects, PDF annotation, annotation navigation, Canvas queries, and metadata hierarchy modules shipped in 0.2. Charts, Kanban, arbitrary resizable panes, saved layouts, and six themes shipped in 0.3 and are and documented in [FEATURES.md](FEATURES.md). The items below are broader product work beyond those modules.

1. **Trust the vault.** Finish rename/link repair, recover/restore UI, folder drag-and-drop, external change reconciliation, attachments and migration tests. Add source/claim/concept note kinds.
2. **Handle real scale.** SQLite indexing, lazy document loading, virtualized explorer, incremental indexing and multilevel graph rendering. Define test corpora before target metrics.
3. **Curate retrieval.** Visual chunk inspector, local vector index, model-specific chunking, hybrid retrieval, evidence-backed edges and dataset evaluation.
4. **Synchronize optionally.** Ship the consented encrypted sync service after auth, conflict, encryption and restore testing. Preserve a useful free/offline core.
5. **Extend carefully.** Read-only local MCP/search endpoint first; then scoped automation, team knowledge workflows and a permissioned extension API.

## Useful next decisions

- Is the first real dataset Markdown, PDFs, websites, code repositories, or a mixture?
- Which RAG pipelines need direct integration first: a portable JSONL workflow, LlamaIndex, LangChain, or an existing custom pipeline?
- Should graph organization prefer topic clusters, hierarchical outlines, freeform canvases, or multiple interchangeable views?
- How should a person distinguish sources, claims and synthesized concepts, and what metadata is mandatory?

Pricing, account systems, collaboration, embeddings and additional source-ingestion pipelines are future work. Nothing in this build represents a production scale or security certification.
