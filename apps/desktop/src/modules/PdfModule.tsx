import { useEffect, useRef, useState } from "react";
import {
  getDocument,
  GlobalWorkerOptions,
  TextLayer,
  type PDFDocumentProxy,
  type PageViewport,
  type RenderTask,
} from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "./pdf-text-layer.css";
import {
  FilePlus,
  ChevronLeft,
  ChevronRight,
  Highlighter,
  Underline,
  Strikethrough,
  MessageSquare,
  Pencil,
  MousePointer2,
  RotateCw,
  Minus,
  Plus,
  Undo2,
  Redo2,
  Trash2,
  Search,
} from "lucide-react";
import type { Annotation } from "../../../../packages/core/modules";
import type { ModuleProps } from "./ModuleHost";
GlobalWorkerOptions.workerSrc = workerUrl;
type Tool = "select" | Annotation["kind"];
const tools: { id: Tool; title: string; icon: typeof Highlighter }[] = [
  { id: "select", title: "Select annotations", icon: MousePointer2 },
  { id: "highlight", title: "Highlight text", icon: Highlighter },
  { id: "underline", title: "Underline text", icon: Underline },
  { id: "strikeout", title: "Strike through text", icon: Strikethrough },
  { id: "comment", title: "Comment on an area", icon: MessageSquare },
  { id: "ink", title: "Freehand ink", icon: Pencil },
];
export default function PdfModule({
  vault,
  state,
  commit,
  onImport,
}: ModuleProps & { onImport(): Promise<void> }) {
  const [docId, setDocId] = useState(state.documents[0]?.id ?? ""),
    [pdf, setPdf] = useState<PDFDocumentProxy | null>(null),
    [page, setPage] = useState(1),
    [scale, setScale] = useState(1),
    [rotation, setRotation] = useState(0),
    [viewport, setViewport] = useState<PageViewport | null>(null),
    [tool, setTool] = useState<Tool>("select"),
    [color, setColor] = useState("#f1c75b"),
    [width, setWidth] = useState(2),
    [selected, setSelected] = useState(""),
    [comment, setComment] = useState(""),
    [filter, setFilter] = useState(""),
    [kindFilter, setKindFilter] = useState("all"),
    [error, setError] = useState(""),
    [rendering, setRendering] = useState(false),
    [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<{ x: number; y: number }[]>([]),
    gesture = useRef<{ x: number; y: number }[] | null>(null);
  const [undo, setUndo] = useState<Annotation[][]>([]),
    [redo, setRedo] = useState<Annotation[][]>([]);
  const canvas = useRef<HTMLCanvasElement>(null),
    textLayer = useRef<HTMLDivElement>(null),
    pageRef = useRef<HTMLDivElement>(null),
    scrollRef = useRef<HTMLDivElement>(null),
    viewportRef = useRef<PageViewport | null>(null),
    selectedRef = useRef("");
  const doc = state.documents.find((d) => d.id === docId) ?? state.documents[0];
  const documentCount = useRef(state.documents.length);
  useEffect(() => {
    if (state.documents.length > documentCount.current)
      setDocId(state.documents.at(-1)!.id);
    documentCount.current = state.documents.length;
  }, [state.documents]);
  useEffect(() => {
    let cancelled = false;
    setPdf(null);
    setViewport(null);
    setError("");
    setPage(1);
    setSelected("");
    setUndo([]);
    setRedo([]);
    if (!doc) return;
    let loading: ReturnType<typeof getDocument> | undefined;
    window.aster
      .readPdf({ vaultId: vault.id, documentId: doc.id })
      .then(async (result) => {
        if (cancelled) return;
        loading = getDocument({
          data: new Uint8Array(result.data),
          useSystemFonts: true,
          enableXfa: false,
          cMapUrl: new URL("./pdfjs/cmaps/", document.baseURI).href,
          cMapPacked: true,
          standardFontDataUrl: new URL(
            "./pdfjs/standard_fonts/",
            document.baseURI,
          ).href,
          wasmUrl: new URL("./pdfjs/wasm/", document.baseURI).href,
          useWorkerFetch: false,
        });
        const loaded = await loading.promise;
        if (!cancelled) setPdf(loaded);
        else await loading.destroy();
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
      void loading?.destroy();
    };
  }, [doc?.id, vault.id]);
  useEffect(() => {
    if (!pdf || !canvas.current || !textLayer.current) return;
    let cancelled = false,
      task: RenderTask | undefined,
      layer: TextLayer | undefined;
    setRendering(true);
    setError("");
    const targetCanvas = canvas.current,
      targetText = textLayer.current;
    void (async () => {
      try {
        const source = await pdf.getPage(page);
        if (cancelled) return;
        const vp = source.getViewport({
          scale,
          rotation: (source.rotate + rotation) % 360,
        });
        viewportRef.current = vp;
        setViewport(vp);
        const dpr = window.devicePixelRatio || 1;
        targetCanvas.width = Math.floor(vp.width * dpr);
        targetCanvas.height = Math.floor(vp.height * dpr);
        targetCanvas.style.width = `${vp.width}px`;
        targetCanvas.style.height = `${vp.height}px`;
        targetText.replaceChildren();
        targetText.style.setProperty("--total-scale-factor", String(vp.scale));
        targetText.style.setProperty("--scale-factor", String(vp.scale));
        task = source.render({
          canvas: targetCanvas,
          viewport: vp,
          transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0],
        });
        await task.promise;
        if (cancelled) return;
        const textContent = await source.getTextContent();
        if (cancelled) return;
        layer = new TextLayer({
          textContentSource: textContent,
          container: targetText,
          viewport: vp,
        });
        await layer.render();
        if (!cancelled) {
          setRendering(false);
          requestAnimationFrame(() => {
            const el = pageRef.current?.querySelector(
              `[data-annotation-id="${selectedRef.current}"]`,
            );
            el?.scrollIntoView({ block: "center", inline: "center" });
          });
        }
      } catch (e) {
        if (!cancelled && (e as Error).name !== "RenderingCancelledException") {
          setError(String(e));
          setRendering(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
      layer?.cancel();
    };
  }, [pdf, page, scale, rotation]);
  const savedComment =
    doc?.annotations.find((a) => a.id === selected)?.comment ?? "";
  useEffect(() => {
    setComment(savedComment);
    selectedRef.current = selected;
  }, [selected, doc?.id, savedComment]);
  const mutate = async (next: Annotation[], remember = true) => {
    if (!doc) return false;
    setSaving(true);
    setError("");
    const previous = structuredClone(doc.annotations);
    try {
      await commit((s) => {
        const d = s.documents.find((d) => d.id === doc.id);
        if (!d) throw new Error("Document is no longer in this vault.");
        d.annotations = next;
      });
      if (remember) {
        setUndo((u) => [...u.slice(-49), previous]);
        setRedo([]);
      }
      return true;
    } catch (e) {
      setError(String(e));
      return false;
    } finally {
      setSaving(false);
    }
  };
  const add = async (annotation: Annotation) => {
    if (await mutate([...(doc?.annotations ?? []), annotation]))
      setSelected(annotation.id);
  };
  const base = (kind: Annotation["kind"]): Annotation => ({
    id: crypto.randomUUID(),
    page,
    kind,
    color,
    width,
    quads: [],
    points: [],
    quote: "",
    comment: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  const pdfPoint = (x: number, y: number) => {
    const [px, py] = viewportRef.current!.convertToPdfPoint(x, y);
    return { x: px, y: py };
  };
  const screen = (p: { x: number; y: number }) => {
    const [x, y] = viewport!.convertToViewportPoint(p.x, p.y);
    return { x, y };
  };
  const textSelection = () => {
    if (
      saving ||
      rendering ||
      !pdf ||
      !["highlight", "underline", "strikeout"].includes(tool) ||
      !viewportRef.current ||
      !doc
    )
      return;
    const selection = window.getSelection();
    if (!selection?.rangeCount || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    if (!textLayer.current?.contains(range.commonAncestorContainer)) return;
    const origin = pageRef.current!.getBoundingClientRect();
    const rects = Array.from(range.getClientRects()).filter(
      (r) =>
        r.width > 1 &&
        r.height > 1 &&
        r.left < origin.right &&
        r.right > origin.left &&
        r.top < origin.bottom &&
        r.bottom > origin.top,
    );
    const seen = new Set<string>();
    const quads = rects
      .filter((r) => {
        const key = [r.left, r.top, r.width, r.height]
          .map(Math.round)
          .join(",");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((r) => {
        const x = Math.max(0, r.left - origin.left),
          y = Math.max(0, r.top - origin.top),
          right = Math.min(origin.width, r.right - origin.left),
          bottom = Math.min(origin.height, r.bottom - origin.top);
        const corners = [
          pdfPoint(x, y),
          pdfPoint(right, y),
          pdfPoint(right, bottom),
          pdfPoint(x, bottom),
        ];
        const shift = viewportRef.current!.rotation / 90;
        return corners.map((_, i) => corners[(i + shift) % 4]);
      });
    if (!quads.length) return;
    const a = {
      ...base(tool as Annotation["kind"]),
      quads,
      quote: selection.toString().slice(0, 10000),
    };
    selection.removeAllRanges();
    void add(a);
  };
  const pointer = (e: React.PointerEvent) => {
    const rect = pageRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(rect.width, e.clientX - rect.left)),
      y: Math.max(0, Math.min(rect.height, e.clientY - rect.top)),
    };
  };
  const startGesture = (e: React.PointerEvent) => {
    if (
      saving ||
      rendering ||
      !pdf ||
      !viewportRef.current ||
      !["ink", "comment"].includes(tool)
    )
      return;
    e.preventDefault();
    gesture.current = [pointer(e)];
    setDraft(gesture.current);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const moveGesture = (e: React.PointerEvent) => {
    if (!gesture.current) return;
    const p = pointer(e);
    if (tool === "ink") {
      if (gesture.current.length < 20000) gesture.current.push(p);
    } else gesture.current = [gesture.current[0], p];
    setDraft([...gesture.current]);
  };
  const endGesture = (e: React.PointerEvent) => {
    const points = gesture.current;
    if (!points) return;
    gesture.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDraft([]);
    const end = pointer(e);
    if (tool === "ink") {
      if (points.length > 1)
        void add({
          ...base("ink"),
          points: points.map((p) => pdfPoint(p.x, p.y)),
        });
    } else {
      const start = points[0],
        x = Math.min(start.x, end.x),
        y = Math.min(start.y, end.y),
        w = Math.max(12, Math.abs(start.x - end.x)),
        h = Math.max(12, Math.abs(start.y - end.y));
      void add({
        ...base("comment"),
        quads: [
          [
            pdfPoint(x, y),
            pdfPoint(x + w, y),
            pdfPoint(x + w, y + h),
            pdfPoint(x, y + h),
          ],
        ],
      });
    }
  };
  const jump = (a: Annotation) => {
    setSelected(a.id);
    selectedRef.current = a.id;
    setPage(a.page);
    if (a.page === page)
      requestAnimationFrame(() =>
        pageRef.current
          ?.querySelector(`[data-annotation-id="${a.id}"]`)
          ?.scrollIntoView({
            block: "center",
            inline: "center",
            behavior: "smooth",
          }),
      );
  };
  const active = doc?.annotations.find((a) => a.id === selected);
  const list = (doc?.annotations ?? [])
    .filter(
      (a) =>
        (kindFilter === "all" || a.kind === kindFilter) &&
        `${a.quote} ${a.comment}`.toLowerCase().includes(filter.toLowerCase()),
    )
    .slice()
    .sort((a, b) => a.page - b.page || a.createdAt - b.createdAt);
  return (
    <div className="pdf-module">
      <header className="module-page-heading">
        <div>
          <span className="eyebrow">READ. MARK. RETURN.</span>
          <h1>PDF library</h1>
        </div>
        <div className="module-toolbar">
          <select
            aria-label="PDF document"
            value={doc?.id ?? ""}
            onChange={(e) => setDocId(e.target.value)}
          >
            {!doc && <option value="">No PDFs yet</option>}
            {state.documents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.path.split("/").pop()}
              </option>
            ))}
          </select>
          <button
            className="primary"
            disabled={saving}
            onClick={() => void onImport()}
          >
            <FilePlus size={15} />
            Import PDF
          </button>
        </div>
      </header>
      {doc && (
        <div className="pdf-toolbar">
          <div className="pdf-tool-group">
            {tools.map((t) => (
              <button
                key={t.id}
                title={t.title}
                aria-pressed={tool === t.id}
                className={tool === t.id ? "active" : ""}
                onClick={() => setTool(t.id)}
              >
                <t.icon size={17} />
              </button>
            ))}
          </div>
          <input
            type="color"
            aria-label="Annotation color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
          <label className="pdf-stroke">
            Width
            <input
              aria-label="Ink width"
              type="number"
              min={0.5}
              max={20}
              step={0.5}
              value={width}
              onChange={(e) =>
                setWidth(Math.max(0.5, Math.min(20, +e.target.value || 0.5)))
              }
            />
          </label>
          <div className="pdf-tool-group">
            <button
              title="Undo annotation"
              disabled={!undo.length || saving}
              onClick={async () => {
                const previous = undo.at(-1)!;
                if (await mutate(previous, false)) {
                  setRedo((r) => [...r, structuredClone(doc.annotations)]);
                  setUndo((u) => u.slice(0, -1));
                }
              }}
            >
              <Undo2 size={16} />
            </button>
            <button
              title="Redo annotation"
              disabled={!redo.length || saving}
              onClick={async () => {
                const next = redo.at(-1)!;
                if (await mutate(next, false)) {
                  setUndo((u) => [...u, structuredClone(doc.annotations)]);
                  setRedo((r) => r.slice(0, -1));
                }
              }}
            >
              <Redo2 size={16} />
            </button>
          </div>
          <div className="pdf-pagination">
            <button
              title="Previous PDF page"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <input
              aria-label="PDF page"
              type="number"
              min={1}
              max={pdf?.numPages ?? 1}
              value={page}
              onChange={(e) => {
                const p = +e.target.value;
                if (p >= 1 && p <= (pdf?.numPages ?? 1)) setPage(p);
              }}
            />
            <span>/ {pdf?.numPages ?? "—"}</span>
            <button
              title="Next PDF page"
              disabled={!pdf || page >= pdf.numPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <button
            title="Zoom out PDF"
            onClick={() => setScale((s) => Math.max(0.4, s - 0.2))}
          >
            <Minus size={15} />
          </button>
          <span className="pdf-scale">{Math.round(scale * 100)}%</span>
          <button
            title="Zoom in PDF"
            onClick={() => setScale((s) => Math.min(3, s + 0.2))}
          >
            <Plus size={15} />
          </button>
          <button
            title="Rotate PDF view"
            onClick={() => setRotation((r) => (r + 90) % 360)}
          >
            <RotateCw size={16} />
          </button>
        </div>
      )}
      {error && (
        <div className="module-error" role="alert">
          {error}
        </div>
      )}
      {!doc ? (
        <div className="module-empty pdf-empty">
          <FilePlus size={34} />
          <h2>Your sources, with room for thought.</h2>
          <p>
            Import a PDF to highlight text, mark passages, leave comments, and
            draw on its pages.
          </p>
          <p>
            The original PDF is kept intact. Annotations are saved in your
            vault’s sidecar.
          </p>
        </div>
      ) : (
        <div className="pdf-body">
          <div className="pdf-scroll" ref={scrollRef}>
            <div className="pdf-instructions">
              {tool === "select"
                ? "Select an annotation from the list or click its mark."
                : tool === "ink"
                  ? "Draw directly on the page."
                  : tool === "comment"
                    ? "Drag an area, then write your comment in the annotation panel."
                    : "Select text on the PDF to apply this mark."}
              {saving ? " Saving…" : rendering ? " Rendering page…" : ""}
            </div>
            <div
              className={`pdf-page tool-${tool}`}
              ref={pageRef}
              data-page-number={page}
              style={{
                width: viewport?.width ?? 612,
                height: viewport?.height ?? 792,
                pointerEvents: saving || rendering || !pdf ? "none" : undefined,
              }}
              onPointerUp={() => requestAnimationFrame(textSelection)}
            >
              <canvas ref={canvas} />
              <div
                className="textLayer"
                ref={textLayer}
                style={{
                  pointerEvents: [
                    "highlight",
                    "underline",
                    "strikeout",
                  ].includes(tool)
                    ? "auto"
                    : "none",
                }}
              />
              {viewport && (
                <svg
                  className="pdf-annotation-overlay"
                  width={viewport.width}
                  height={viewport.height}
                  viewBox={`0 0 ${viewport.width} ${viewport.height}`}
                  style={{
                    pointerEvents: ["ink", "comment"].includes(tool)
                      ? "auto"
                      : "none",
                    touchAction: "none",
                  }}
                  onPointerDown={startGesture}
                  onPointerMove={moveGesture}
                  onPointerUp={endGesture}
                  onPointerCancel={() => {
                    gesture.current = null;
                    setDraft([]);
                  }}
                >
                  {doc.annotations
                    .filter((a) => a.page === page)
                    .map((a) => (
                      <g
                        key={a.id}
                        data-annotation-id={a.id}
                        className={
                          a.id === selected ? "annotation-selected" : ""
                        }
                        style={{
                          pointerEvents: tool === "select" ? "auto" : "none",
                          cursor: "pointer",
                        }}
                        onClick={() => jump(a)}
                      >
                        {a.quads.map((q, i) => {
                          const p = q.map(screen),
                            polygon = p.map((p) => `${p.x},${p.y}`).join(" ");
                          if (a.kind === "highlight" || a.kind === "comment")
                            return (
                              <polygon
                                key={i}
                                points={polygon}
                                fill={a.color}
                                fillOpacity={
                                  a.kind === "highlight" ? 0.3 : 0.08
                                }
                                stroke={
                                  a.kind === "comment" || a.id === selected
                                    ? a.color
                                    : "none"
                                }
                                strokeWidth={a.id === selected ? 2 : 1}
                                strokeDasharray={
                                  a.kind === "comment" ? "4 3" : undefined
                                }
                              />
                            );
                          const left =
                              a.kind === "underline"
                                ? p[3]
                                : {
                                    x: (p[0].x + p[3].x) / 2,
                                    y: (p[0].y + p[3].y) / 2,
                                  },
                            right =
                              a.kind === "underline"
                                ? p[2]
                                : {
                                    x: (p[1].x + p[2].x) / 2,
                                    y: (p[1].y + p[2].y) / 2,
                                  };
                          return (
                            <line
                              key={i}
                              x1={left.x}
                              y1={left.y}
                              x2={right.x}
                              y2={right.y}
                              stroke={a.color}
                              strokeWidth={a.width * scale}
                            />
                          );
                        })}
                        {a.points.length > 0 && (
                          <polyline
                            points={a.points
                              .map(screen)
                              .map((p) => `${p.x},${p.y}`)
                              .join(" ")}
                            fill="none"
                            stroke={a.color}
                            strokeWidth={a.width * scale}
                            strokeLinejoin="round"
                            strokeLinecap="round"
                          />
                        )}
                        {a.id === selected && a.quads[0] && (
                          <circle
                            cx={screen(a.quads[0][0]).x}
                            cy={screen(a.quads[0][0]).y}
                            r={5}
                            fill={a.color}
                          />
                        )}
                      </g>
                    ))}
                  {draft.length > 0 &&
                    (tool === "ink" ? (
                      <polyline
                        points={draft.map((p) => `${p.x},${p.y}`).join(" ")}
                        fill="none"
                        stroke={color}
                        strokeWidth={width * scale}
                      />
                    ) : (
                      <rect
                        x={Math.min(draft[0].x, draft.at(-1)!.x)}
                        y={Math.min(draft[0].y, draft.at(-1)!.y)}
                        width={Math.abs(draft[0].x - draft.at(-1)!.x)}
                        height={Math.abs(draft[0].y - draft.at(-1)!.y)}
                        fill={color}
                        fillOpacity={0.12}
                        stroke={color}
                      />
                    ))}
                </svg>
              )}
            </div>
          </div>
          <aside className="annotations-panel">
            <header>
              <h2>Annotations</h2>
              <span>{doc.annotations.length}</span>
            </header>
            <div className="annotation-filters">
              <Search size={14} />
              <input
                aria-label="Search annotations"
                placeholder="Quote or comment"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
              <select
                aria-label="Annotation type filter"
                value={kindFilter}
                onChange={(e) => setKindFilter(e.target.value)}
              >
                <option value="all">All types</option>
                {["highlight", "underline", "strikeout", "comment", "ink"].map(
                  (k) => (
                    <option key={k}>{k}</option>
                  ),
                )}
              </select>
            </div>
            <div className="annotation-list">
              {list.map((a) => (
                <button
                  key={a.id}
                  className={`annotation-entry ${selected === a.id ? "active" : ""}`}
                  onClick={() => jump(a)}
                  aria-label={`${a.kind} on page ${a.page}`}
                >
                  <span className="annotation-meta">
                    <i style={{ background: a.color }} />
                    Page {a.page}
                    <small>{a.kind}</small>
                  </span>
                  <span>
                    {a.comment ||
                      a.quote ||
                      (a.kind === "ink" ? "Freehand drawing" : "Area comment")}
                  </span>
                </button>
              ))}
              {!list.length && (
                <p className="muted">
                  Your annotations will appear here. Select one to jump to its
                  exact page and location.
                </p>
              )}
            </div>
            {active && (
              <div className="annotation-editor">
                <span className="section-label">
                  SELECTED · PAGE {active.page}
                </span>
                {active.quote && <blockquote>{active.quote}</blockquote>}
                <label>
                  Comment
                  <textarea
                    aria-label="Annotation comment"
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                </label>
                <div className="annotation-editor-actions">
                  <button
                    className="primary"
                    disabled={saving}
                    onClick={() =>
                      void mutate(
                        doc.annotations.map((a) =>
                          a.id === selected
                            ? { ...a, comment, updatedAt: Date.now() }
                            : a,
                        ),
                      )
                    }
                  >
                    Save comment
                  </button>
                  <button
                    title="Delete annotation"
                    disabled={saving}
                    onClick={() => {
                      void mutate(
                        doc.annotations.filter((a) => a.id !== selected),
                      );
                      setSelected("");
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            )}
            <footer>Saved with this PDF revision · editable sidecar</footer>
          </aside>
        </div>
      )}
    </div>
  );
}
