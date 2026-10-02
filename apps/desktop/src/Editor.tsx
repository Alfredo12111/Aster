import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkspaceTab } from "../../../packages/core/workspace";
import { useModules } from "./modules/ModuleProvider";
import { themes } from "./themes";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import { autocompletion } from "@codemirror/autocomplete";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BookOpen, Code2, FileText, CheckSquare } from "lucide-react";
import type { Note } from "../../../packages/core/types";
import { buildResolver } from "../../../packages/core/knowledge";
type Props = {
  note: Note;
  notes: Note[];
  value: string;
  onChange(text: string): void;
  onOpen(id: string): void;
  status: string;
  onCreateTask?(excerpt: string): void;
  passage?: WorkspaceTab["passage"];
};
const editorTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      background: "transparent",
      color: "var(--text)",
      fontSize: "15px",
    },
    ".cm-content": {
      fontFamily: "'Cascadia Code', 'Consolas', monospace",
      padding: "22px 0",
      lineHeight: "1.9",
      caretColor: "var(--accent)",
    },
    ".cm-gutters": {
      background: "transparent",
      border: "none",
      color: "var(--muted)",
    },
    ".cm-line": { padding: "0 28px" },
    ".cm-activeLine": { background: "#ffffff03" },
    ".cm-scroller": { overflow: "auto" },
    ".cm-cursor": { borderLeftColor: "var(--accent)" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
      background: "#e6bb7824",
    },
    ".cm-tooltip": {
      background: "var(--side)",
      border: "1px solid var(--line)",
    },
  },
  {},
);
export default function Editor({
  note,
  notes,
  value,
  onChange,
  onOpen,
  status,
  onCreateTask,
  passage,
}: Props) {
  const { snapshot } = useModules();
  const light = themes[snapshot?.state.workspace.theme ?? "aster"].light;
  const [preview, setPreview] = useState(false);
  const editor = useRef<EditorView | null>(null);
  const revealPassage = (view: EditorView) => {
    if (!passage) return;
    const text = view.state.doc.toString();
    let start = passage.start;
    if (text.slice(start, passage.end) !== passage.quote) {
      start = text.indexOf(passage.quote);
      if (start < 0 || text.indexOf(passage.quote, start + 1) >= 0) return;
    }
    view.dispatch({
      selection: { anchor: start, head: start + passage.quote.length },
      effects: EditorView.scrollIntoView(start, { y: "center" }),
    });
    view.focus();
  };
  useEffect(() => {
    if (passage) {
      setPreview(false);
      if (editor.current) revealPassage(editor.current);
    }
  }, [passage]);
  const extensions = useMemo(
    () => [
      markdown(),
      editorTheme,
      EditorView.lineWrapping,
      autocompletion({
        override: [
          (context) => {
            const match = context.matchBefore(/\[\[[^\]\n]*/);
            if (!match) return null;
            return {
              from: match.from + 2,
              options: notes
                .filter((n) => n.id !== note.id)
                .map((n) => ({
                  label: n.path.replace(/\.md$/i, ""),
                  displayLabel: n.title,
                  detail: n.path,
                  type: "text",
                  apply: n.path.replace(/\.md$/i, "") + "]]",
                })),
            };
          },
        ],
      }),
    ],
    [notes, note.id],
  );
  const resolve = useMemo(() => buildResolver(notes), [notes]);
  const rendered = value.replace(/\[\[([^\]\n]+)\]\]/g, (_m, inner: string) => {
    const [target, label] = inner.split("|");
    return `[${label ?? target}](#note-${encodeURIComponent(target)})`;
  });
  return (
    <section className="editor-panel">
      <div className="editor-toolbar">
        <div className="editor-path">
          <FileText size={14} />
          <span>{note.path}</span>
        </div>
        <button
          title="Create task from this note"
          onClick={() => {
            const range = editor.current?.state.selection.main;
            const excerpt =
              range && !range.empty
                ? editor.current!.state.sliceDoc(range.from, range.to)
                : "";
            onCreateTask?.(excerpt.slice(0, 4000));
          }}
        >
          <CheckSquare size={15} />
        </button>
        <div className="segmented small">
          <button
            className={!preview ? "active" : ""}
            title="Edit Markdown"
            onClick={() => setPreview(false)}
          >
            <Code2 size={14} />
          </button>
          <button
            className={preview ? "active" : ""}
            title="Read formatted note"
            onClick={() => setPreview(true)}
          >
            <BookOpen size={14} />
          </button>
        </div>
      </div>
      {note.metadataError && (
        <div className="error-banner">Frontmatter: {note.metadataError}</div>
      )}
      <div className="note-heading">
        <span className="eyebrow">{preview ? "READING" : "MARKDOWN"}</span>
        <h2>{note.title}</h2>
        <div className="note-tags">
          {note.tags.map((t) => (
            <span key={t}>#{t}</span>
          ))}
        </div>
      </div>
      {preview ? (
        <article className="markdown-preview">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children }) =>
                href?.startsWith("#note-") ? (
                  <button
                    className="wiki-link"
                    onClick={() => {
                      const n = resolve(
                        decodeURIComponent(href.slice(6)),
                        note,
                      );
                      if (n) onOpen(n.id);
                    }}
                  >
                    {children}
                  </button>
                ) : (
                  <span title={href}>{children} ↗</span>
                ),
              img: ({ alt }) => (
                <span className="attachment-label">[Image: {alt}]</span>
              ),
            }}
          >
            {rendered}
          </ReactMarkdown>
        </article>
      ) : (
        <div className="codemirror-wrap">
          <CodeMirror
            onCreateEditor={(view) => {
              editor.current = view;
              revealPassage(view);
            }}
            key={note.id}
            value={value}
            extensions={extensions}
            onChange={onChange}
            theme={light ? "light" : "dark"}
            basicSetup={{
              lineNumbers: false,
              foldGutter: false,
              highlightActiveLineGutter: false,
              autocompletion: false,
            }}
            height="100%"
            aria-label="Markdown editor"
          />
        </div>
      )}
      <div className="editor-footer">
        <span>{value.trim() ? value.trim().split(/\s+/).length : 0} words</span>
        <span>{status}</span>
      </div>
    </section>
  );
}
