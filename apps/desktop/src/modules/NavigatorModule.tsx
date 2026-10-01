import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FileText,
  Search,
  AlertCircle,
} from "lucide-react";
import {
  metadataTree,
  folderTree,
  flattenTree,
} from "../../../../packages/core/hierarchy";
import { fieldValue, noteMetadata } from "../../../../packages/core/metadata";
import { displayValue } from "../../../../packages/core/query";
import type { ModuleProps } from "./ModuleHost";
export default function NavigatorModule({ vault, onOpen }: ModuleProps) {
  const [source, setSource] = useState("metadata"),
    [parentField, setParentField] = useState("parent"),
    [folder, setFolder] = useState(""),
    [field, setField] = useState(""),
    [value, setValue] = useState(""),
    [query, setQuery] = useState(""),
    [expanded, setExpanded] = useState(new Set<string>()),
    [scroll, setScroll] = useState(0),
    [focus, setFocus] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setScroll(0);
    setFocus(0);
    if (viewport.current) viewport.current.scrollTop = 0;
  }, [source, parentField, folder, field, value, query]);
  const fields = useMemo(
    () =>
      [
        ...new Set(vault.notes.flatMap((n) => Object.keys(noteMetadata(n)))),
      ].sort(),
    [vault.notes],
  );
  const roots = useMemo(
    () =>
      source === "metadata"
        ? metadataTree(vault.notes, parentField)
        : folderTree(vault.notes),
    [vault.notes, source, parentField],
  );
  const matching = useMemo(
    () =>
      !folder && !query && !(field && value)
        ? undefined
        : new Set(
            vault.notes
              .filter(
                (n) =>
                  (!folder || n.path.startsWith(folder + "/")) &&
                  (!query ||
                    `${n.title} ${n.path} ${n.tags.join(" ")}`
                      .toLowerCase()
                      .includes(query.toLowerCase())) &&
                  (!(field && value) ||
                    displayValue(fieldValue(n, field))
                      .toLowerCase()
                      .includes(value.toLowerCase())),
              )
              .map((n) => n.id),
          ),
    [vault.notes, folder, field, value, query],
  );
  const rows = useMemo(
    () => flattenTree(roots, expanded, matching),
    [roots, expanded, matching],
  );
  const start = Math.max(0, Math.floor(scroll / 38) - 6),
    visible = rows.slice(start, start + 38);
  const toggle = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const expandAll = () => {
    const ids = new Set<string>(),
      stack = [...roots];
    while (stack.length) {
      const n = stack.pop()!;
      if (n.children.length) ids.add(n.id);
      stack.push(...n.children);
    }
    setExpanded(ids);
  };
  return (
    <div className="module-page navigator-module">
      <header className="module-page-heading">
        <div>
          <span className="eyebrow">STRUCTURE BEYOND CONNECTIONS</span>
          <h1>Vault navigator</h1>
        </div>
        <div className="module-toolbar">
          <button className="quiet-button" onClick={expandAll}>
            Expand all
          </button>
          <button
            className="quiet-button"
            onClick={() => setExpanded(new Set())}
          >
            Collapse all
          </button>
        </div>
      </header>
      <div className="navigator-filters">
        <label>
          Hierarchy
          <select
            aria-label="Hierarchy source"
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setScroll(0);
              if (viewport.current) viewport.current.scrollTop = 0;
            }}
          >
            <option value="metadata">Frontmatter parent</option>
            <option value="folders">Folder structure</option>
          </select>
        </label>
        {source === "metadata" && (
          <label>
            Parent field
            <input
              value={parentField}
              onChange={(e) => setParentField(e.target.value)}
            />
          </label>
        )}
        <label>
          Folder
          <select
            aria-label="Navigator folder"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
          >
            <option value="">All folders</option>
            {vault.folders.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        <label>
          Metadata field
          <select
            aria-label="Metadata field"
            value={field}
            onChange={(e) => setField(e.target.value)}
          >
            <option value="">Any field</option>
            {fields.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        <label>
          Contains value
          <input
            aria-label="Metadata value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={!field}
          />
        </label>
      </div>
      <div className="navigator-search">
        <Search size={16} />
        <input
          aria-label="Search hierarchy"
          placeholder="Find a note, folder, or tag"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span>
          {matching?.size ?? vault.notes.length} notes · {rows.length} visible
          rows
        </span>
      </div>
      <div
        className="hierarchy-viewport"
        ref={viewport}
        tabIndex={0}
        role="tree"
        aria-label="Vault hierarchy"
        onScroll={(e) => setScroll(e.currentTarget.scrollTop)}
        onKeyDown={(e) => {
          const row = rows[focus];
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            const next = Math.max(
              0,
              Math.min(
                rows.length - 1,
                focus + (e.key === "ArrowDown" ? 1 : -1),
              ),
            );
            setFocus(next);
            viewport.current?.scrollTo({ top: Math.max(0, next * 38 - 100) });
          }
          if (row && ["ArrowRight", "ArrowLeft"].includes(e.key)) {
            e.preventDefault();
            setExpanded((s) => {
              const n = new Set(s);
              e.key === "ArrowRight"
                ? n.add(row.node.id)
                : n.delete(row.node.id);
              return n;
            });
          }
          if (e.key === "Enter" && row?.node.noteId) onOpen(row.node.noteId);
        }}
      >
        <div style={{ height: rows.length * 38, position: "relative" }}>
          {visible.map((row, i) => (
            <div
              key={row.node.id}
              role="treeitem"
              aria-level={row.depth + 1}
              aria-expanded={
                row.node.children.length
                  ? expanded.has(row.node.id) || !!matching
                  : undefined
              }
              aria-selected={focus === start + i}
              className={`hierarchy-row ${focus === start + i ? "focused" : ""}`}
              style={{
                position: "absolute",
                top: (start + i) * 38,
                left: 0,
                right: 0,
                paddingLeft: 14 + Math.min(row.depth, 20) * 20,
              }}
              onClick={() => setFocus(start + i)}
            >
              <button
                className="hierarchy-toggle"
                aria-label={`Expand ${row.node.label}`}
                onClick={() => toggle(row.node.id)}
                disabled={!row.node.children.length}
              >
                {row.node.children.length ? (
                  expanded.has(row.node.id) || matching ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )
                ) : null}
              </button>
              {row.node.issue ? (
                <AlertCircle className="warning" size={15} />
              ) : row.node.noteId ? (
                <FileText size={15} />
              ) : (
                <Folder size={15} />
              )}
              <button
                className="hierarchy-name"
                onClick={() =>
                  row.node.noteId
                    ? onOpen(row.node.noteId)
                    : toggle(row.node.id)
                }
                title={
                  row.node.issue ??
                  vault.notes.find((n) => n.id === row.node.noteId)?.path
                }
              >
                {row.node.label}
              </button>
              {row.node.issue && (
                <span className="hierarchy-issue">{row.node.issue}</span>
              )}
              <span className="hierarchy-count">{row.count}</span>
            </div>
          ))}
        </div>
        {!rows.length && <div className="module-empty">No matching notes.</div>}
      </div>
      <footer className="navigator-footer">
        {source === "metadata" ? (
          <>
            Define hierarchy with <code>parent: "[[Note name]]"</code> in
            frontmatter. Missing parents and cycles stay visible under Hierarchy
            issues.
          </>
        ) : (
          <>Folder hierarchy follows your vault’s actual directories.</>
        )}{" "}
        <span>Only visible rows are rendered.</span>
      </footer>
    </div>
  );
}
