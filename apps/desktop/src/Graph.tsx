import { useEffect, useMemo, useRef, useState } from 'react';
import { Focus, Minus, Plus, Move, Pin } from 'lucide-react';
import type { GraphEdge, GraphView, Note, Point, VaultSettings } from '../../../packages/core/types';
import { groupOf, PALETTE } from '../../../packages/core/types';

export function colorFor(note: Note, settings: VaultSettings, groups: string[]) {
  return settings.noteColors[note.id] ?? settings.colors[groupOf(note.path)] ?? PALETTE[Math.max(0, groups.indexOf(groupOf(note.path))) % PALETTE.length];
}
export function arrange(notes: Note[], layout: 'cluster' | 'radial' | 'force'): Record<string, Point> {
  const groups = [...new Set(notes.map(n => groupOf(n.path)))]; const positions: Record<string, Point> = {};
  if (layout === 'radial') notes.forEach((n, i) => { const angle = i / Math.max(notes.length, 1) * Math.PI * 2; const r = Math.max(230, notes.length * 17); positions[n.id] = { x: Math.cos(angle) * r, y: Math.sin(angle) * r }; });
  else groups.forEach((g, gi) => {
    const angle = gi / groups.length * Math.PI * 2 - Math.PI / 2;
    const center = groups.length === 1 ? { x: 0, y: 0 } : { x: Math.cos(angle) * 325, y: Math.sin(angle) * 260 };
    notes.filter(n => groupOf(n.path) === g).forEach((n, i, list) => {
      const a = i / list.length * Math.PI * 2 + gi * .5; const r = list.length === 1 ? 0 : Math.max(90, Math.sqrt(list.length) * 62);
      positions[n.id] = { x: center.x + Math.cos(a) * r, y: center.y + Math.sin(a) * r };
    });
  });
  return positions;
}
type Props = { notes: Note[]; edges: GraphEdge[]; settings: VaultSettings; view: GraphView; selected: string; groups: string[]; onSelect(id: string): void; onOpen(id: string): void; onMove(id: string, point: Point): void };
export default function Graph({ notes, edges, settings, view, selected, groups, onSelect, onOpen, onMove }: Props) {
  const [themeRevision,setThemeRevision]=useState(0);
  useEffect(()=>{const update=()=>setThemeRevision(n=>n+1);window.addEventListener("aster-theme",update);return()=>window.removeEventListener("aster-theme",update);},[]);
  const canvas = useRef<HTMLCanvasElement>(null), container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 }), [camera, setCamera] = useState({ x: 0, y: 0, zoom: .75 });
  const [hover, setHover] = useState(''), [dragPosition, setDragPosition] = useState<{ id: string; point: Point } | null>(null);
  const drag = useRef<{ node?: string; start: Point; camera: { x: number; y: number; zoom: number }; moved: boolean } | null>(null);
  const defaults = useMemo(() => arrange(notes, view.layout), [notes.map(n => n.id).join(','), view.layout]);
  const positions = useMemo(() => ({ ...defaults, ...view.positions, ...(dragPosition ? { [dragPosition.id]: dragPosition.point } : {}) }), [defaults, view.positions, dragPosition]);
  const focus = () => {
    const ps = notes.map(n => positions[n.id]); if (!ps.length) return;
    const minX = Math.min(...ps.map(p => p.x)), maxX = Math.max(...ps.map(p => p.x)), minY = Math.min(...ps.map(p => p.y)), maxY = Math.max(...ps.map(p => p.y));
    const zoom = Math.min(1.3, (size.w - 200) / Math.max(100, maxX - minX), (size.h - 180) / Math.max(100, maxY - minY));
    setCamera({ x: -(minX + maxX) / 2 * zoom, y: -(minY + maxY) / 2 * zoom, zoom: Math.max(.12, zoom) });
  };
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    if (container.current) ro.observe(container.current); return () => ro.disconnect();
  }, []);
  useEffect(() => { focus(); }, [size.w, size.h, view.id, view.layout, notes.length]);
  const project = (p: Point) => ({ x: p.x * camera.zoom + size.w / 2 + camera.x, y: p.y * camera.zoom + size.h / 2 + camera.y });
  const invert = (p: Point) => ({ x: (p.x - size.w / 2 - camera.x) / camera.zoom, y: (p.y - size.h / 2 - camera.y) / camera.zoom });
  const local = (e: { clientX: number; clientY: number }) => { const rect = canvas.current!.getBoundingClientRect(); return { x: e.clientX - rect.left, y: e.clientY - rect.top }; };
  const hit = (p: Point) => notes.find(n => { const s = project(positions[n.id]); return Math.hypot(s.x - p.x, s.y - p.y) < Math.max(14, settings.nodeSize * camera.zoom + 7); });
  useEffect(() => {
    const el = canvas.current; if (!el) return; const ctx = el.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1; el.width = size.w * dpr; el.height = size.h * dpr;
    ctx.scale(dpr, dpr); ctx.clearRect(0, 0, size.w, size.h);
    const active = hover || selected;
    const adjacent = new Set(edges.filter(e => e.source === active || e.target === active).flatMap(e => [e.source, e.target]));
    const noteMap = new Map(notes.map(n => [n.id, n]));
    for (const edge of edges) {
      const a = positions[edge.source], b = positions[edge.target];
      if (!a || !b || !noteMap.has(edge.source) || !noteMap.has(edge.target)) continue;
      const p = project(a), q = project(b), highlighted = edge.source === active || edge.target === active;
      const color = colorFor(noteMap.get(edge.source)!, settings, groups);
      ctx.globalAlpha = highlighted ? .8 : settings.linkOpacity / 100 * (active ? .38 : .75);
      ctx.strokeStyle = highlighted ? color : '#90959c'; ctx.lineWidth = highlighted ? 1.5 : .9;
      ctx.setLineDash(edge.origin === 'manual' ? [5, 4] : []);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); ctx.setLineDash([]);
      if (settings.showArrows) {
        const angle = Math.atan2(q.y - p.y, q.x - p.x), r = settings.nodeSize * camera.zoom + 4;
        const tip = { x: q.x - Math.cos(angle) * r, y: q.y - Math.sin(angle) * r };
        ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(tip.x - Math.cos(angle - .4) * 7, tip.y - Math.sin(angle - .4) * 7); ctx.moveTo(tip.x, tip.y); ctx.lineTo(tip.x - Math.cos(angle + .4) * 7, tip.y - Math.sin(angle + .4) * 7); ctx.stroke();
      }
      if (edge.origin === 'manual' && highlighted && camera.zoom > .6) { ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--text"); ctx.font = '11px Segoe UI'; ctx.textAlign = 'center'; ctx.fillText(edge.kind, (p.x + q.x) / 2, (p.y + q.y) / 2 - 8); }
    }
    const occupied: { x: number; y: number; w: number; h: number }[] = [];
    const drawingOrder = [...notes].sort((a, b) => (b.id === active ? 2 : adjacent.has(b.id) ? 1 : 0) - (a.id === active ? 2 : adjacent.has(a.id) ? 1 : 0));
    for (const note of drawingOrder) {
      const p = project(positions[note.id]); if (p.x < -150 || p.x > size.w + 150 || p.y < -50 || p.y > size.h + 50) continue;
      const color = colorFor(note, settings, groups), isActive = note.id === active, r = Math.max(3, settings.nodeSize * camera.zoom + (isActive ? 3 : 0));
      ctx.globalAlpha = active && !isActive && !adjacent.has(note.id) ? .68 : 1;
      if (isActive) { ctx.beginPath(); ctx.arc(p.x, p.y, r + 8, 0, Math.PI * 2); ctx.fillStyle = color + '16'; ctx.fill(); ctx.strokeStyle = color + '77'; ctx.lineWidth = 1; ctx.stroke(); }
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
      if (settings.showLabels && (notes.length < 250 || camera.zoom > 1.2 || isActive)) {
        ctx.font = `${isActive ? '600' : '400'} ${isActive ? 13 : 12}px Segoe UI`; ctx.textAlign = 'center';
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(isActive?"--text":"--muted");
        const label = note.title.length > 30 ? note.title.slice(0, 29) + '…' : note.title;
        const width = ctx.measureText(label).width;
        const box = { x: p.x - width / 2 - 4, y: p.y + r + 7, w: width + 8, h: 19 };
        if (isActive || !occupied.some(b => box.x < b.x + b.w && box.x + box.w > b.x && box.y < b.y + b.h && box.y + box.h > b.y)) {
          occupied.push(box); ctx.fillText(label, p.x, p.y + r + 21);
        }
      }
    }
    ctx.globalAlpha = 1;
  }, [notes, edges, positions, settings, camera, size, selected, hover,themeRevision]);
  useEffect(() => {
    const el = canvas.current!;
    const wheel = (e: WheelEvent) => { e.preventDefault(); const p = local(e), world = invert(p); const zoom = Math.min(4, Math.max(.08, camera.zoom * Math.exp(-e.deltaY * .0015))); setCamera({ x: p.x - size.w / 2 - world.x * zoom, y: p.y - size.h / 2 - world.y * zoom, zoom }); };
    el.addEventListener('wheel', wheel, { passive: false }); return () => el.removeEventListener('wheel', wheel);
  }, [camera, size]);
  return <div className="graph-canvas" ref={container}>
    <canvas ref={canvas} aria-label="Knowledge graph. Select notes using the file tree or drag nodes to arrange them." tabIndex={0}
      style={{ width: size.w, height: size.h, cursor: drag.current ? 'grabbing' : hover ? 'grab' : 'default' }}
      onPointerDown={e => { const p = local(e), node = hit(p); drag.current = { node: node?.id, start: p, camera: { ...camera }, moved: false }; e.currentTarget.setPointerCapture(e.pointerId); if (node) onSelect(node.id); }}
      onPointerMove={e => { const p = local(e); const d = drag.current; if (!d) { setHover(hit(p)?.id ?? ''); return; } if (Math.hypot(p.x - d.start.x, p.y - d.start.y) > 3) d.moved = true; if (d.node && d.moved) setDragPosition({ id: d.node, point: invert(p) }); else if (!d.node) setCamera({ ...d.camera, x: d.camera.x + p.x - d.start.x, y: d.camera.y + p.y - d.start.y }); }}
      onPointerUp={e => { if (drag.current?.node && drag.current.moved && dragPosition) onMove(drag.current.node, dragPosition.point); drag.current = null; setDragPosition(null); e.currentTarget.releasePointerCapture(e.pointerId); }}
      onPointerCancel={() => { drag.current = null; setDragPosition(null); }} onPointerLeave={() => setHover('')}
      onDoubleClick={e => { const n = hit(local(e)); if (n) onOpen(n.id); }}
      onKeyDown={e => { if (e.key === 'Enter' && selected) onOpen(selected); if (e.key === '+' || e.key === '=') setCamera(c => ({ ...c, zoom: Math.min(4, c.zoom * 1.2) })); if (e.key === '-') setCamera(c => ({ ...c, zoom: Math.max(.08, c.zoom / 1.2) })); if (e.key === '0') focus(); if (e.key.startsWith('Arrow')) { e.preventDefault(); setCamera(c => ({ ...c, x: c.x + (e.key === 'ArrowLeft' ? 40 : e.key === 'ArrowRight' ? -40 : 0), y: c.y + (e.key === 'ArrowUp' ? 40 : e.key === 'ArrowDown' ? -40 : 0) })); } }} />
    {!notes.length && <div className="graph-empty">No notes match this view.</div>}
    <div className="graph-hint"><Move size={13}/> Drag to arrange <span>·</span> Double-click to write</div>
    <div className="zoom-controls"><button title="Zoom out" onClick={() => setCamera(c => ({ ...c, zoom: Math.max(.08, c.zoom / 1.2) }))}><Minus size={16}/></button><span>{Math.round(camera.zoom * 100)}%</span><button title="Zoom in" onClick={() => setCamera(c => ({ ...c, zoom: Math.min(4, c.zoom * 1.2) }))}><Plus size={16}/></button><button title="Fit graph (0)" onClick={focus}><Focus size={16}/></button></div>
    <div className="graph-caption"><Pin size={12}/> Positions saved in this view</div>
  </div>;
}
