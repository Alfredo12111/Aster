# Connected maps and evidence

## Put tools on the map

Create your workbook, chart, Kanban board, Canvas board, project, task or PDF in its module first. In Graph or Tree, choose **Add tool node**, select the item, and assign a map folder and optional parent note. Calendar is also available. Each node opens the original item; renaming that item updates its map title.

Double-click to open, or select once and use **Open** in its details. Tree nodes also open with Enter. The details let you change node color, move its map location, remove the pin, or connect it to another note or pinned tool using a labeled relationship. Normal graph dragging and saved positions also work for tool nodes. Graph shapes distinguish square tool nodes from round notes.

Map folders organize pins without moving files. **Remove from map** preserves the actual item. Dormant manual relationships and positions remain in vault settings; a newly added pin gets a new node identity. If a source item is deleted, its existing pin shows a missing-source message rather than opening a different item.

Some connections come directly from stored data: a chart uses a workbook or Markdown table; a task comes from a note and belongs to a project; a project includes notes; a project-scoped Kanban organizes that project. Tool-to-tool edges appear when both items are pinned. These are labeled **From source data** and are changed through their native tools. Arbitrary query results are not inferred as fixed relationships.

## The organized Tree view

Choose **Tree view** beside the graph heading, or add **Tree** through a pane's **＋ View** selector. Graph remains available with its existing freeform layout.

- **Folders** follows note paths and virtual tool-map folders.
- **Parent metadata** follows a note's `parent` frontmatter, or another scalar field entered in **Parent field**. Tool pins use their chosen parent note with the default `parent` field.
- Expand/collapse branches, adjust zoom, scroll in both directions, or use **Fit tree**. At low zoom, zoom back in to read individual cards.
- Filtering uses the same text, `tag:` and `path:` syntax as Graph. It retains ancestors and expands matching paths, so clear the filter to collapse those paths manually.

For example:

```yaml
---
parent: "[[Research question]]"
status: reviewed
---
```

Missing, ambiguous, multiple or cyclic parents remain visible under hierarchy issues. The tree positions nodes automatically; it does not rewrite frontmatter or move files. Its diagram is bounded to 600 visible cards. Filter/collapse branches for larger collections, or use the virtualized Navigator list. Zoom, hierarchy choice and collapsed branches are session state; saved workspace layouts retain the Tree surface and tool targets.

## Attach evidence to a connection

Create a manual relationship, then choose **Evidence** in Connections, a tool's details, or by clicking a manual graph edge. Attach either:

1. An exact passage from a **saved note**. The dialog can display its saved text. Use enough surrounding text to identify a unique passage. Aster records the note ID, revision, character span, quote and capture time.
2. An existing **PDF annotation**. Aster records its document ID, fingerprint, annotation identity/version, page and captured quote or comment. Geometry remains in the PDF's editable annotation record.

**Open evidence source** selects and scrolls to the note passage, or opens the PDF's page and annotation. If the note passage moved, Aster locates it only when the exact quote is unique. A missing or ambiguous passage is not replaced with a guessed selection.

The evidence card shows **Source current**, **Source changed**, or **Source missing**, based on the currently saved note/module records. A changed revision preserves the captured quote. Review the source before using **Confirm reviewed source**, or remove and attach new evidence. Confirmation does not assess whether the relationship's claim is true. Removed sources do not erase their captured quote.

PDF bytes are checked when opening the document. An externally replaced PDF is rejected by the reader; the evidence status alone does not continually rehash unopened files. Import revised bytes as a new document and attach reviewed evidence from it. Annotations can be edited without changing the original PDF bytes.

## Storage and export

Pins live in `.aster/modules.json`; manual relationships and their evidence live in `.aster/vault.json`. The existing revision checks and recovery histories apply. Back up the entire vault, including attachments and `.aster`.

Markdown RAG JSONL includes captured evidence on its exported note-to-note relationships. It does not yet export a tool catalog, workbook cells, all PDF text, or a separate annotation corpus. Capturing evidence supports review and traceability; it is not an automated fact-checking or answering system.
