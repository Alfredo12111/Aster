import { useMemo, useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { EditorView } from '@codemirror/view';
import { autocompletion } from '@codemirror/autocomplete';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BookOpen, Code2, FileText, CheckSquare } from 'lucide-react';
import type { Note } from '../../../packages/core/types';
import { buildResolver } from '../../../packages/core/knowledge';
type Props = { note: Note; notes: Note[]; value: string; onChange(text: string): void; onOpen(id: string): void; status: string; onCreateTask?(excerpt: string): void };
const editorTheme = EditorView.theme({
  '&': { height: '100%', background: 'transparent', color: '#dadbe0', fontSize: '15px' },
  '.cm-content': { fontFamily: "'Cascadia Code', 'Consolas', monospace", padding: '22px 0', lineHeight: '1.9', caretColor: '#e6bb78' },
  '.cm-gutters': { background: 'transparent', border: 'none', color: '#51545b' }, '.cm-line': { padding: '0 28px' },
  '.cm-activeLine': { background: '#ffffff03' }, '.cm-scroller': { overflow: 'auto' }, '.cm-cursor': { borderLeftColor: '#e6bb78' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { background: '#e6bb7824' },
  '.cm-tooltip': { background: '#27292d', border: '1px solid #444' },
}, { dark: true });
export default function Editor({ note, notes, value, onChange, onOpen, status, onCreateTask }: Props) {
  const [preview, setPreview] = useState(false);
  const editor = useRef<EditorView | null>(null);
  const extensions = useMemo(() => [markdown(), editorTheme, EditorView.lineWrapping, autocompletion({ override: [context => {
    const match = context.matchBefore(/\[\[[^\]\n]*/); if (!match) return null;
    return { from: match.from + 2, options: notes.filter(n => n.id !== note.id).map(n => ({ label: n.path.replace(/\.md$/i, ''), displayLabel: n.title, detail: n.path, type: 'text', apply: n.path.replace(/\.md$/i, '') + ']]' })) };
  }] })], [notes, note.id]);
  const resolve = useMemo(() => buildResolver(notes), [notes]);
  const rendered = value.replace(/\[\[([^\]\n]+)\]\]/g, (_m, inner: string) => { const [target, label] = inner.split('|'); return `[${label ?? target}](#note-${encodeURIComponent(target)})`; });
  return <section className="editor-panel">
    <div className="editor-toolbar"><div className="editor-path"><FileText size={14}/><span>{note.path}</span></div><button title="Create task from this note" onClick={() => { const range = editor.current?.state.selection.main; const excerpt = range && !range.empty ? editor.current!.state.sliceDoc(range.from, range.to) : ""; onCreateTask?.(excerpt.slice(0, 4000)); }}><CheckSquare size={15}/></button><div className="segmented small"><button className={!preview ? 'active' : ''} title="Edit Markdown" onClick={() => setPreview(false)}><Code2 size={14}/></button><button className={preview ? 'active' : ''} title="Read formatted note" onClick={() => setPreview(true)}><BookOpen size={14}/></button></div></div>
    {note.metadataError && <div className="error-banner">Frontmatter: {note.metadataError}</div>}<div className="note-heading"><span className="eyebrow">{preview ? 'READING' : 'MARKDOWN'}</span><h2>{note.title}</h2><div className="note-tags">{note.tags.map(t => <span key={t}>#{t}</span>)}</div></div>
    {preview ? <article className="markdown-preview"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({ href, children }) => href?.startsWith('#note-') ? <button className="wiki-link" onClick={() => { const n = resolve(decodeURIComponent(href.slice(6)), note); if (n) onOpen(n.id); }}>{children}</button> : <span title={href}>{children} ↗</span>, img: ({ alt }) => <span className="attachment-label">[Image: {alt}]</span> }}>{rendered}</ReactMarkdown></article> : <div className="codemirror-wrap"><CodeMirror onCreateEditor={view => { editor.current = view; }} key={note.id} value={value} extensions={extensions} onChange={onChange} theme="dark" basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLineGutter: false, autocompletion: false }} height="100%" aria-label="Markdown editor" /></div>}
    <div className="editor-footer"><span>{value.trim() ? value.trim().split(/\s+/).length : 0} words</span><span>{status}</span></div>
  </section>;
}
