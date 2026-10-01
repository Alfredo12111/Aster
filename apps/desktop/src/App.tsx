import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Asterisk, Network, PanelLeft, PanelRight, FileText, Folder, FolderOpen, Search, Plus, ChevronDown, ChevronRight, Settings2, Sparkles, ArrowUpRight, Link2, X, Check, Download, Command, SlidersHorizontal, Columns2, PenLine, RefreshCw, Trash2, Pencil, FolderPlus, HardDrive, KeyRound, LoaderCircle, CircleHelp, Layers, CheckCheck, Puzzle } from 'lucide-react';
import { buildEdges, matchesNote, suggestConnections } from '../../../packages/core/knowledge';
import { folderOf, groupOf, PALETTE, type AiSettings, type GraphView, type Note, type Suggestion, type VaultSettings, type VaultSnapshot } from '../../../packages/core/types';
import Graph, { arrange, colorFor } from './Graph';
import Editor from './Editor';
import ModuleHost from './modules/ModuleHost';

type Draft = { content: string; revision: string };
type Modal = 'note' | 'folder' | 'view' | 'move' | 'trash' | 'ai' | 'command' | 'help' | null;
const api = window.aster;
const message = (e: unknown) => String(e instanceof Error ? e.message : e).replace(/^Error invoking remote method '[^']+': Error: /, '');

export default function App() {
  const [vault, setVault] = useState<VaultSnapshot | null>(null), [selected, setSelected] = useState('');
  const [mode, setMode] = useState<'graph' | 'split' | 'write' | 'modules'>('graph');
  const [pendingTask, setPendingTask] = useState<{ noteId: string; excerpt: string } | null>(null);
  const [panel, setPanel] = useState<'style' | 'links' | 'discover'>('style');
  const [query, setQuery] = useState(''), [collapsed, setCollapsed] = useState(new Set<string>());
  const [error, setError] = useState(''), [toast, setToast] = useState(''), [status, setStatus] = useState('All changes saved');
  const [drafts, setDrafts] = useState<Record<string, Draft>>({}); const draftRef = useRef(drafts); draftRef.current = drafts;
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({}), inFlight = useRef(new Map<string, Promise<boolean>>());
  const [modal, setModal] = useState<Modal>(null), [name, setName] = useState(''), [modalError, setModalError] = useState('');
  const [busy, setBusy] = useState(false), [layoutBusy, setLayoutBusy] = useState(false);
  const [showTree, setShowTree] = useState(true), [showInspector, setShowInspector] = useState(true);
  const [aiConfig, setAiConfig] = useState<AiSettings>({ provider: 'openai', model: '', hasKey: false }), [key, setKey] = useState('');
  const [aiResults, setAiResults] = useState<Suggestion[] | null>(null), [aiBusy, setAiBusy] = useState(false);
  const [relationTarget, setRelationTarget] = useState(''), [relationType, setRelationType] = useState('relates to');
  const settingsPending = useRef(false), settingsGeneration = useRef(0), settingsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSettings = useRef<VaultSettings | null>(null), currentVaultId = useRef('');
  const dialogRef = useRef<HTMLDialogElement>(null), searchRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);

  const notify = (text: string) => { setToast(text); window.setTimeout(() => setToast(''), 4200); };
  const adopt = (data: VaultSnapshot, reset = false) => {
    setVault(data); latestSettings.current = data.settings; currentVaultId.current = data.id;
    setSelected(previous => !reset && data.notes.some(n => n.id === previous) ? previous : (data.notes.find(n => n.title === 'Knowledge architecture') ?? data.notes[0])?.id ?? '');
  };
  const load = async () => { try { adopt(await api.load()); setError(''); } catch (e) { setError(message(e)); } };
  useEffect(() => { if (api) void load(); else setError('Open Aster as a desktop app to access your local vaults. Run Start Aster.cmd in the project folder.'); }, []);
  useEffect(() => {
    if (!api) return;
    return api.onVaultChanged(() => { if (!Object.keys(draftRef.current).length && !settingsPending.current) void load(); });
  }, []);
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => { if (Object.keys(draftRef.current).length || settingsPending.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload); return () => window.removeEventListener('beforeunload', beforeUnload);
  }, []);
  useEffect(() => { setAiResults(null); setRelationTarget(''); }, [selected, vault?.id]);
  useEffect(() => { if (modal && dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal(); else if (!modal) dialogRef.current?.close(); }, [modal]);

  const flush = useCallback(async (id: string): Promise<boolean> => {
    const existing = inFlight.current.get(id); if (existing) { const ok = await existing; if (!ok) return false; if (draftRef.current[id]) return flush(id); return true; }
    const draft = draftRef.current[id]; if (!draft) return true;
    clearTimeout(timers.current[id]); setStatus('Saving…');
    const promise = (async () => {
      try {
        const saved = await api.saveNote({ id, ...draft });
        setVault(v => v ? { ...v, notes: v.notes.map(n => n.id === id ? saved : n) } : v);
        const next = { ...draftRef.current };
        if (next[id]?.content === draft.content) delete next[id]; else if (next[id]) next[id] = { ...next[id], revision: saved.revision };
        draftRef.current = next; setDrafts(next); setStatus(Object.keys(next).length ? 'Unsaved changes' : 'All changes saved'); setError(''); return true;
      } catch (e) { setError(message(e)); setStatus('Draft not saved'); return false; }
    })();
    inFlight.current.set(id, promise); const ok = await promise; inFlight.current.delete(id);
    if (ok && draftRef.current[id]) return flush(id); return ok;
  }, []);
  const flushAll = async () => {
    const results = await Promise.all(Object.keys(draftRef.current).map(flush));
    if (settingsPending.current) await persistSettings();
    return results.every(Boolean) && !settingsPending.current;
  };
  const edit = (note: Note, content: string) => {
    const next = { ...draftRef.current, [note.id]: { content, revision: draftRef.current[note.id]?.revision ?? note.revision } };
    draftRef.current = next; setDrafts(next); setStatus('Unsaved changes'); clearTimeout(timers.current[note.id]); timers.current[note.id] = setTimeout(() => void flush(note.id), 650);
  };
  const saveDraftCopy = async () => {
    const source = vault?.notes.find(n => n.id === selected); if (!source) return;
    if (inFlight.current.has(source.id)) await inFlight.current.get(source.id);
    const draft = draftRef.current[source.id]; if (!draft) return;
    clearTimeout(timers.current[source.id]);
    try {
      const copyPath = source.path.replace(/\.md$/i, '') + ` (draft ${Date.now()}).md`;
      const created = await api.createNote(copyPath); const copy = created.notes.find(n => n.path === copyPath)!;
      const saved = await api.saveNote({ id: copy.id, content: draft.content, revision: copy.revision });
      const remaining = { ...draftRef.current }; delete remaining[source.id]; draftRef.current = remaining; setDrafts(remaining);
      adopt(await api.load()); setSelected(saved.id); setMode('split'); setError(''); setStatus(Object.keys(remaining).length ? 'Unsaved changes' : 'All changes saved'); notify('Draft saved as a separate note. The original file is preserved.');
    } catch (e) { setError(message(e)); }
  };
  const persistSettings = async () => {
    if (!latestSettings.current) return; if (settingsTimer.current) clearTimeout(settingsTimer.current);
    const generation = settingsGeneration.current;
    try { await api.saveSettings(latestSettings.current); if (generation === settingsGeneration.current) settingsPending.current = false; }
    catch (e) { setError(`Graph settings were not saved: ${message(e)}`); }
  };
  const updateSettings = (patch: Partial<VaultSettings>) => {
    if (!latestSettings.current) return; const next = { ...latestSettings.current, ...patch };
    latestSettings.current = next; settingsPending.current = true; settingsGeneration.current++;
    setVault(v => v ? { ...v, settings: next } : v);
    if (settingsTimer.current) clearTimeout(settingsTimer.current); settingsTimer.current = setTimeout(() => void persistSettings(), 350);
  };
  const updateView = (patch: Partial<GraphView>) => { if (!latestSettings.current) return; const s = latestSettings.current; updateSettings({ views: s.views.map(v => v.id === s.activeView ? { ...v, ...patch } : v) }); };
  const openModal = (kind: Modal, initial = '') => { setName(initial); setModalError(''); setModal(kind); if (kind === 'ai') { setKey(''); api.aiSettings().then(setAiConfig).catch(e => setModalError(message(e))); } };
  const openNote = (id: string) => { setSelected(id); if (mode === 'graph' || mode === 'modules') setMode('split'); };
  const switchVault = async (create = false) => {
    try { if (!await flushAll()) return; const data = await (create ? api.createVault() : api.openVault()); if (data) { adopt(data, true); setQuery(''); setDrafts({}); draftRef.current = {}; setError(''); setAiResults(null); } } catch (e) { setError(message(e)); }
  };
  useEffect(() => {
    const shortcut = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() === 's') { e.preventDefault(); void flushAll(); }
      if (e.key.toLowerCase() === 'p') { e.preventDefault(); openModal('command'); }
      if (e.key.toLowerCase() === 'n') { e.preventDefault(); openModal('note'); }
      if (e.key.toLowerCase() === 'g') { e.preventDefault(); setMode('graph'); }
      if (e.key.toLowerCase() === 'f' && e.shiftKey) { e.preventDefault(); setShowTree(true); setTimeout(() => searchRef.current?.focus(), 0); }
    };
    document.addEventListener('keydown', shortcut); return () => document.removeEventListener('keydown', shortcut);
  });
  const edges = useMemo(() => vault ? buildEdges(vault) : [], [vault?.notes, vault?.settings.relations]);
  const groups = useMemo(() => [...new Set(vault?.notes.map(n => groupOf(n.path)) ?? [])].sort(), [vault?.notes]);
  const note = vault?.notes.find(n => n.id === selected), settings = vault?.settings;
  const view = settings?.views.find(v => v.id === settings.activeView) ?? settings?.views[0];
  const graphNotes = useMemo(() => vault?.notes.filter(n => matchesNote(n, view?.filter ?? '')) ?? [], [vault?.notes, view?.filter]);
  const suggestions = useMemo(() => vault && selected ? suggestConnections(vault, selected) : [], [vault?.notes, vault?.settings.relations, selected]);
  const localEdges = edges.filter(e => e.source === selected || e.target === selected);

  const applyLayout = (layout: GraphView['layout']) => {
    if (!vault || !view) return; workerRef.current?.terminate(); setLayoutBusy(false);
    if (layout !== 'force') { updateView({ layout, positions: arrange(vault.notes, layout) }); return; }
    setLayoutBusy(true); const worker = new Worker(new URL('./layout.worker.ts', import.meta.url), { type: 'module' }); workerRef.current = worker;
    const targetVault = vault.id, targetView = view.id;
    worker.onmessage = e => { if (currentVaultId.current === targetVault && latestSettings.current?.activeView === targetView) updateView({ layout, positions: e.data }); setLayoutBusy(false); worker.terminate(); };
    worker.onerror = () => { setLayoutBusy(false); setError('The graph could not be arranged. Try the clustered layout.'); worker.terminate(); };
    const positions = arrange(vault.notes, 'cluster'); worker.postMessage({ nodes: vault.notes.map(n => ({ id: n.id, ...positions[n.id] })), edges: edges.map(e => ({ source: e.source, target: e.target })) });
  };
  const addRelation = (target: string, kind = relationType) => {
    if (!settings || !target || target === selected) return;
    if (settings.relations.some(e => e.source === selected && e.target === target && e.kind === kind)) { notify('That connection already exists'); return; }
    updateSettings({ relations: [...settings.relations, { id: crypto.randomUUID(), source: selected, target, kind }] }); notify('Connection added');
  };
  const runAi = async () => {
    if (!await flushAll()) return; const requested = selected, vaultId = vault!.id;
    setAiBusy(true); setAiResults(null);
    try { const results = await api.suggestAi(requested); if (currentVaultId.current === vaultId) { setSelected(requested); setAiResults(results); } } catch (e) { setError(message(e)); } finally { setAiBusy(false); }
  };
  const submitModal = async () => {
    setBusy(true); setModalError('');
    try {
      if (modal === 'note') { const data = await api.createNote(name.trim()); adopt(data); const path = /\.md$/i.test(name) ? name : `${name}.md`; const n = data.notes.find(n => n.path === path.replace(/\\/g, '/')); if (n) { setSelected(n.id); setMode('split'); } }
      if (modal === 'folder') adopt(await api.createFolder(name.trim()));
      if (modal === 'move' && note) { if (!await flushAll()) throw new Error('Resolve unsaved changes before moving this note.'); adopt(await api.moveNote({ id: note.id, path: name.trim() })); }
      if (modal === 'trash' && note) { if (!await flushAll()) throw new Error('Resolve unsaved changes before deleting this note.'); adopt(await api.trashNote(note.id)); notify('Note moved to .aster/trash'); }
      if (modal === 'view' && settings) { const id = crypto.randomUUID(); updateSettings({ views: [...settings.views, { ...view!, id, name: name.trim(), positions: { ...view!.positions } }], activeView: id }); }
      if (modal === 'ai') { setAiConfig(await api.saveAiSettings({ provider: aiConfig.provider, model: aiConfig.model, ...(key ? { key } : {}) })); setKey(''); notify('AI settings saved securely'); }
      setModal(null);
    } catch (e) { setModalError(message(e)); } finally { setBusy(false); }
  };
  const renderTree = (parent = '', depth = 0): React.ReactNode => {
    if (!vault) return null;
    const folders = vault.folders.filter(f => folderOf(f) === parent);
    const notes = vault.notes.filter(n => folderOf(n.path) === parent);
    return <>{folders.map(f => <div key={f}><button className="tree-folder" style={{ paddingLeft: 13 + depth * 14 }} onClick={() => setCollapsed(prev => { const next = new Set(prev); next.has(f) ? next.delete(f) : next.add(f); return next; })}>{collapsed.has(f) ? <ChevronRight size={13}/> : <ChevronDown size={13}/>}<Folder size={15} style={{ color: settings!.colors[groupOf(f + '/n.md')] ?? PALETTE[Math.max(0, groups.indexOf(groupOf(f + '/n.md'))) % PALETTE.length] }}/><span>{f.split('/').pop()}</span><small>{vault.notes.filter(n => n.path.startsWith(f + '/')).length}</small></button>{!collapsed.has(f) && renderTree(f, depth + 1)}</div>)}{notes.map(n => <button key={n.id} title={n.path} className={`tree-note ${selected === n.id ? 'selected' : ''}`} style={{ paddingLeft: 28 + depth * 14 }} onClick={() => openNote(n.id)}><FileText size={14}/><span>{n.title}</span>{drafts[n.id] && <span className="draft-dot"/>}</button>)}</>;
  };
  const modalTitle = { note: 'New note', folder: 'New folder', view: 'Save a graph view', move: 'Move or rename note', trash: 'Move note to vault trash?', ai: 'Your AI, your key', command: 'Jump to a note', help: 'Make yourself at home' };
  return <div className={`app ${showTree ? '' : 'hide-tree'} ${showInspector && mode !== 'modules' ? '' : 'hide-inspector'}`}>
    <aside className="activity-bar"><button className="brand-symbol" title="Aster" onClick={() => setMode('graph')}><Asterisk size={30} strokeWidth={1.6}/></button><div className="activity-group"><button className={mode === 'graph' ? 'active' : ''} title="Graph (Ctrl+G)" onClick={() => setMode('graph')}><Network size={21}/></button><button className={mode === 'write' ? 'active' : ''} title="Writing" onClick={() => setMode('write')}><PenLine size={21}/></button><button title="Find a note (Ctrl+P)" onClick={() => openModal('command')}><Search size={21}/></button><button title="Discover connections" className={panel === 'discover' ? 'active' : ''} onClick={() => { setPanel('discover'); setShowInspector(true); }}><Sparkles size={21}/></button></div><button className={mode === "modules" ? "active" : ""} title="Built-in modules" onClick={() => setMode("modules")}><Puzzle size={21}/></button><div className="activity-bottom"><button title="Keyboard shortcuts" onClick={() => openModal('help')}><CircleHelp size={20}/></button><button title="AI settings" onClick={() => openModal('ai')}><Settings2 size={20}/></button><div className="avatar">A</div></div></aside>
    <aside className="sidebar"><div className="brand-word">aster<span>PERSONAL KNOWLEDGE</span></div><button className="vault-picker" onClick={() => void switchVault()} title="Open another vault"><div className="vault-icon"><Layers size={20}/></div><div><strong>{vault?.name ?? 'Your vault'}</strong><span>Local vault</span></div><ChevronDown size={14}/></button><div className="vault-actions"><button onClick={() => void switchVault()}><FolderOpen size={13}/>Open</button><button onClick={() => void switchVault(true)}><Plus size={13}/>New vault</button></div><div className="searchbox"><Search size={15}/><input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search your vault" aria-label="Search your vault"/><kbd>Ctrl P</kbd></div>
      <div className="tree-heading"><span>{query ? 'SEARCH RESULTS' : 'EXPLORER'}</span><div><button title="New folder" onClick={() => openModal('folder')}><FolderPlus size={15}/></button><button title="New note (Ctrl+N)" onClick={() => openModal('note', note && folderOf(note.path) ? folderOf(note.path) + '/' : '')}><Plus size={17}/></button></div></div>
      <nav className="file-tree" aria-label="Vault files">{query ? vault?.notes.filter(n => matchesNote(n, query)).map(n => <button className={`tree-note search-result ${selected === n.id ? 'selected' : ''}`} key={n.id} onClick={() => openNote(n.id)}><FileText size={14}/><div><span>{n.title}</span><small>{folderOf(n.path) || 'Vault root'}</small></div></button>) : renderTree()}{vault?.notes.length === 0 && <div className="tree-empty">An empty vault, a fresh start.<button className="primary" onClick={() => openModal('note')}>Create your first note</button></div>}</nav>
      <div className="sidebar-bottom"><button className="export-button" onClick={async () => { if (!await flushAll()) return; try { if (await api.exportRag()) notify('RAG dataset exported'); } catch (e) { setError(message(e)); } }}><Download size={16}/><span>Export for RAG</span><ArrowUpRight size={14}/></button><div className="local-status"><HardDrive size={13}/><span>Stored on this device</span><button title="Show vault folder" onClick={() => api.revealVault()}><FolderOpen size={14}/></button></div></div>
    </aside>
    <main className="workspace"><header className="workspace-header"><div className="breadcrumbs"><button title="Toggle file tree" onClick={() => setShowTree(!showTree)}><PanelLeft size={17}/></button><span>{vault?.name ?? 'Aster'}</span><ChevronRight size={13}/><strong>{mode === 'modules' ? 'Built-in modules' : mode === 'write' ? 'Writing' : 'Graph workspace'}</strong></div><div className="header-actions"><span className="version">LOCAL FIRST</span><button title="Reload from disk" onClick={async () => { if (await flushAll()) await load(); }}><RefreshCw size={15}/></button><button title="Toggle inspector" onClick={() => setShowInspector(!showInspector)}><PanelRight size={17}/></button></div></header>
      <div className="workspace-tabs"><div className="workspace-title"><Network size={17}/><span>{mode === 'modules' ? 'Built-in modules' : view?.name ?? 'My constellation'}</span><span className="tiny-dot"/></div><div className="segmented"><button className={mode === 'graph' ? 'active' : ''} onClick={() => setMode('graph')}><Network size={14}/>Graph</button><button className={mode === 'split' ? 'active' : ''} onClick={() => setMode('split')}><Columns2 size={14}/>Split</button><button className={mode === 'write' ? 'active' : ''} onClick={() => setMode('write')}><FileText size={14}/>Write</button></div></div>
      {error && <div className="error-banner" role="alert"><span>{error}</span><button onClick={() => void flushAll()}>Retry save</button>{drafts[selected] && <button onClick={() => void saveDraftCopy()}>Save draft copy</button>}<button title="Dismiss error" onClick={() => setError('')}><X size={14}/></button></div>}
      <div className={`work-area mode-${mode}`}>
        {mode === "modules" && vault && <ModuleHost key={vault.id} vault={vault} onOpen={openNote} onVault={adopt} initialTask={pendingTask} onTaskHandled={() => setPendingTask(null)}/>}
        {mode !== 'write' && mode !== 'modules' && <section className="graph-panel"><div className="graph-top"><div><span className="eyebrow">YOUR KNOWLEDGE, CONNECTED</span><h1>A wider perspective<span>.</span></h1><p>{graphNotes.length} notes <span>·</span> {edges.length} connections <span>·</span> {groups.length} neighborhoods</p></div><button className="quiet-button" onClick={() => openModal('view')}><Plus size={14}/>Save view</button></div><div className="graph-filter"><Search size={14}/><input aria-label="Filter graph" placeholder="Filter by idea, tag: or path:" value={view?.filter ?? ''} onChange={e => updateView({ filter: e.target.value })}/>{view?.filter && <button title="Clear graph filter" onClick={() => updateView({ filter: '' })}><X size={13}/></button>}</div>
          {vault && settings && view && <Graph notes={graphNotes} edges={edges} settings={settings} view={view} selected={selected} groups={groups} onSelect={setSelected} onOpen={openNote} onMove={(id, point) => updateView({ positions: { ...view.positions, [id]: point } })}/>}
          <div className="graph-legend">{groups.map((g, i) => <button key={g} onClick={() => updateView({ filter: view?.filter === `path:${g}` ? '' : `path:${g}` })}><span style={{ background: settings?.colors[g] ?? PALETTE[i % PALETTE.length] }}/>{g.replace(/^\d+\s*/, '')}</button>)}</div>
        </section>}
        {mode !== 'graph' && mode !== 'modules' && (note ? <Editor note={note} notes={vault!.notes} value={drafts[note.id]?.content ?? note.content} onChange={text => edit(note, text)} onOpen={openNote} status={status} onCreateTask={excerpt => { setPendingTask({ noteId: note.id, excerpt }); setMode("modules"); }}/> : <div className="empty-editor"><FileText size={30}/><h2>A new thought starts here.</h2><button className="primary" onClick={() => openModal('note')}>Create a note</button></div>)}
      </div><footer className="statusbar"><span><CheckCheck size={12}/>{status}</span><span>{note?.title ?? 'No note selected'}<span className="divider">/</span>Markdown<span className="divider">/</span><button onClick={() => openModal('command')}><Command size={12}/>Ctrl+P</button></span></footer>
    </main>
    <aside className="inspector"><div className="inspector-header"><SlidersHorizontal size={16}/><strong>Make it yours</strong><button title="Hide inspector" onClick={() => setShowInspector(false)}><X size={15}/></button></div><div className="inspector-tabs"><button className={panel === 'style' ? 'active' : ''} onClick={() => setPanel('style')}>Appearance</button><button className={panel === 'links' ? 'active' : ''} onClick={() => setPanel('links')}>Connections</button><button className={panel === 'discover' ? 'active' : ''} onClick={() => setPanel('discover')}><Sparkles size={13}/>Discover</button></div>
      <div className="inspector-content">{settings && view && <>
        {panel === 'style' && <><section className="control-section"><label className="section-label" htmlFor="saved-view">SAVED VIEW</label><select id="saved-view" value={settings.activeView} onChange={e => updateSettings({ activeView: e.target.value })}>{settings.views.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select><div className="inline-buttons"><button onClick={() => openModal('view')}><Plus size={13}/>New view</button>{settings.views.length > 1 && <button title="Remove current saved view" onClick={() => updateSettings({ views: settings.views.filter(v => v.id !== view.id), activeView: settings.views.find(v => v.id !== view.id)!.id })}><Trash2 size={13}/></button>}</div></section>
          <section className="control-section"><span className="section-label">ARRANGEMENT</span><div className="layout-options">{(['cluster', 'radial', 'force'] as const).map((l, i) => <button key={l} className={view.layout === l ? 'active' : ''} onClick={() => applyLayout(l)} disabled={layoutBusy}><span className={`layout-icon layout-${l}`}>{Array.from({ length: 7 }, (_, j) => <i key={j} style={{ '--i': j } as React.CSSProperties}/>)}</span><span>{['Clusters', 'Orbit', 'Organic'][i]}</span></button>)}</div><p className="control-hint">{layoutBusy ? 'Finding a little breathing room…' : 'Arrange automatically, then make it your own.'}</p></section>
          <section className="control-section"><span className="section-label">NEIGHBORHOOD COLORS</span>{groups.map((g, i) => <label className="color-row" key={g}><input type="color" aria-label={`Color for ${g}`} value={settings.colors[g] ?? PALETTE[i % PALETTE.length]} onChange={e => updateSettings({ colors: { ...settings.colors, [g]: e.target.value } })}/><span>{g.replace(/^\d+\s*/, '')}</span><small>{vault!.notes.filter(n => groupOf(n.path) === g).length}</small></label>)}</section>
          <section className="control-section"><span className="section-label">DETAILS</span><label className="range-label">Node size<span>{settings.nodeSize}</span><input type="range" min="3" max="16" value={settings.nodeSize} onChange={e => updateSettings({ nodeSize: +e.target.value })}/></label><label className="range-label">Connection opacity<span>{settings.linkOpacity}%</span><input type="range" min="5" max="100" value={settings.linkOpacity} onChange={e => updateSettings({ linkOpacity: +e.target.value })}/></label><label className="toggle-row">Show note labels<input type="checkbox" checked={settings.showLabels} onChange={e => updateSettings({ showLabels: e.target.checked })}/></label><label className="toggle-row">Show direction arrows<input type="checkbox" checked={settings.showArrows} onChange={e => updateSettings({ showArrows: e.target.checked })}/></label></section></>}
        {panel === 'links' && <><section className="control-section"><span className="section-label">CONNECTED TO THIS NOTE</span>{localEdges.length === 0 && <p className="control-hint">Use [[wiki links]] in your note, or add a labeled connection below.</p>}{localEdges.map(e => { const other = vault!.notes.find(n => n.id === (e.source === selected ? e.target : e.source)); return <div className="connection-item" key={e.id}><button onClick={() => other && openNote(other.id)}><Link2 size={14}/><div><strong>{other?.title}</strong><small>{e.source === selected ? 'Outgoing' : 'Incoming'} · {e.kind}</small></div></button>{e.origin === 'manual' && <button title="Remove connection" onClick={() => updateSettings({ relations: settings.relations.filter(r => r.id !== e.id) })}><X size={12}/></button>}</div>; })}</section>{note && <section className="control-section"><span className="section-label">ADD A RELATIONSHIP</span><label className="field-label">Relationship<select aria-label="Relationship" value={relationType} onChange={e => setRelationType(e.target.value)}>{['relates to', 'supports', 'contradicts', 'depends on', 'is an example of', 'extends'].map(t => <option key={t}>{t}</option>)}</select></label><label className="field-label">Connect to<select aria-label="Connect to" value={relationTarget} onChange={e => setRelationTarget(e.target.value)}><option value="">Choose a note</option>{vault!.notes.filter(n => n.id !== selected).map(n => <option key={n.id} value={n.id}>{n.path}</option>)}</select></label><button className="primary full" disabled={!relationTarget} onClick={() => addRelation(relationTarget)}><Plus size={14}/>Add connection</button></section>}</>}
        {panel === 'discover' && <><section className="control-section"><div className="section-label">POSSIBLE CONNECTIONS<span className="local-badge">ON DEVICE</span></div><p className="control-hint">Shared concepts and tags. You decide which connections belong.</p>{suggestions.length === 0 && <p className="empty-copy">No new matches yet. Add more notes to discover connections.</p>}{suggestions.map(s => <SuggestionCard key={s.noteId} suggestion={s} notes={vault!.notes} open={openNote} accept={id => addRelation(id, 'relates to')}/>)}</section><section className="control-section ai-section"><Sparkles size={21}/><h3>A second perspective</h3><p>Ask your AI model to review possible connections for this note.</p><p className="privacy-note">Sends this note and up to 12 candidate excerpts (6,000 characters each) to your selected provider. Only when you click below.</p><button className="primary full" disabled={!note || aiBusy} onClick={() => void runAi()}>{aiBusy ? <LoaderCircle className="spin" size={14}/> : <Sparkles size={14}/>} {aiBusy ? 'Looking for connections…' : 'Suggest with my AI'}</button><button className="text-button" onClick={() => openModal('ai')}><KeyRound size={13}/>Configure my API key</button>{aiResults?.length === 0 && <p className="control-hint">The model found no useful new connections.</p>}{aiResults?.map(s => <SuggestionCard key={s.noteId} suggestion={s} notes={vault!.notes} open={openNote} accept={id => { addRelation(id, 'relates to'); setAiResults(prev => prev?.filter(s => s.noteId !== id) ?? null); }}/>)}</section></>}
      </>}</div>
      {note && settings && <div className="selected-card"><div className="section-label">SELECTED NOTE<div><button title="Move or rename" onClick={() => openModal('move', note.path)}><Pencil size={12}/></button><button title="Move note to trash" onClick={() => openModal('trash')}><Trash2 size={12}/></button></div></div><div className="selected-title"><input type="color" aria-label="Selected note color" value={colorFor(note, settings, groups)} onChange={e => updateSettings({ noteColors: { ...settings.noteColors, [note.id]: e.target.value } })}/><button onClick={() => openNote(note.id)}>{note.title}</button></div><span>{localEdges.length} connections · {note.tags.length} tags</span><button className="text-button" onClick={() => { setMode('split'); setPanel('links'); }}>Open note<ArrowUpRight size={13}/></button></div>}
    </aside>
    {toast && <div className="toast" role="status"><Check size={16}/>{toast}</div>}
    <dialog ref={dialogRef} onCancel={() => setModal(null)} className={`modal ${modal === 'command' ? 'command-modal' : ''}`}><form onSubmit={e => { e.preventDefault(); void submitModal(); }}><div className="modal-heading"><h2>{modal ? modalTitle[modal] : ''}</h2><button type="button" title="Close dialog" onClick={() => setModal(null)}><X size={18}/></button></div>
      {modal === 'help' ? <div className="help-content"><p>Write ordinary Markdown. Connect ideas with <code>[[note name]]</code>. Use a full vault path when names repeat.</p><dl><dt>New note</dt><dd>Ctrl + N</dd><dt>Jump to note</dt><dd>Ctrl + P</dd><dt>Save all drafts</dt><dd>Ctrl + S</dd><dt>Open graph</dt><dd>Ctrl + G</dd><dt>Search vault</dt><dd>Ctrl + Shift + F</dd></dl><p>Drag nodes to save their positions. Double-click a node to write beside the graph. Wheel to zoom; drag the background to pan.</p><p>History is in <code>.aster/history</code>. Deleted notes are in <code>.aster/trash</code>. Sync is planned; this build stores your notes locally.</p></div>
      : modal === 'command' ? <><input autoFocus placeholder="Search notes, content, or tags…" aria-label="Jump to a note" value={name} onChange={e => setName(e.target.value)}/><div className="command-results">{vault?.notes.filter(n => matchesNote(n, name)).slice(0, 40).map(n => <button type="button" key={n.id} onClick={() => { openNote(n.id); setModal(null); }}><FileText size={16}/><span>{n.title}<small>{n.path}</small></span><span>↵</span></button>)}</div></>
      : modal === 'ai' ? <><p>Your key stays on this computer, encrypted by the operating system. It is never included in a vault or export.</p><label className="field-label">Provider<select aria-label="Provider" value={aiConfig.provider} onChange={e => setAiConfig({ provider: e.target.value as AiSettings['provider'], model: '', hasKey: false })}><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option></select></label><label className="field-label">Model ID<input value={aiConfig.model} onChange={e => setAiConfig({ ...aiConfig, model: e.target.value })} placeholder="Enter a model available to your API account" required/></label><label className="field-label">API key<input type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} placeholder={aiConfig.hasKey ? 'Key saved · leave blank to keep' : 'Paste your API key'} /></label><p className="privacy-note">Provider usage is billed to your account. Suggestions are requested manually from Discover. OpenAI requests use store: false; your provider’s data policies still apply.</p>{aiConfig.hasKey && <button type="button" className="text-button danger-text" onClick={async () => { try { setAiConfig(await api.saveAiSettings({ provider: aiConfig.provider, model: aiConfig.model, key: '' })); notify('API key removed'); } catch (e) { setModalError(message(e)); } }}>Remove saved key</button>}</>
      : modal === 'trash' ? <p>“{note?.title}” will be moved to <code>.aster/trash</code> inside your vault. You can recover the Markdown file from that folder.</p>
      : <><label className="field-label">{modal === 'note' || modal === 'move' ? 'File path within this vault' : modal === 'folder' ? 'Folder path within this vault' : 'View name'}<input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder={modal === 'note' ? 'Research/A new idea.md' : modal === 'folder' ? 'Research/Sources' : 'My research map'} required maxLength={modal === 'view' ? 100 : 400}/></label>{modal === 'move' && <p className="privacy-note">Typed relationships and graph positions keep their identity. Markdown links are not rewritten in this alpha; update links that use the old path or name.</p>}{modal === 'view' && <p>This saves your current positions, arrangement, and filter as another view of the same notes.</p>}</>}
      {modalError && <div className="modal-error" role="alert">{modalError}</div>}{modal !== 'command' && modal !== 'help' && <div className="modal-actions"><button type="button" className="quiet-button" onClick={() => setModal(null)}>Cancel</button><button className={`primary ${modal === 'trash' ? 'danger' : ''}`} disabled={busy || (['note', 'folder', 'view', 'move'].includes(modal ?? '') && !name.trim())}>{busy ? 'Working…' : modal === 'trash' ? 'Move to trash' : modal === 'ai' ? 'Save settings' : modal === 'move' ? 'Move note' : 'Create'}</button></div>}
    </form></dialog>
  </div>;
}

function SuggestionCard({ suggestion, notes, open, accept }: { suggestion: Suggestion; notes: Note[]; open(id: string): void; accept(id: string): void }) {
  const note = notes.find(n => n.id === suggestion.noteId); if (!note) return null;
  return <div className="suggestion-card"><button className="suggestion-title" onClick={() => open(note.id)}>{note.title}<ArrowUpRight size={12}/></button><p>{suggestion.reason}</p><button className="text-button" onClick={() => accept(note.id)}><Plus size={13}/>Connect notes</button></div>;
}
