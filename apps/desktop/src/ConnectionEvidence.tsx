import { useState } from "react";
import type { Relation, VaultSnapshot } from "../../../packages/core/types";
import {
  evidenceStatus,
  noteEvidence,
  pdfEvidence,
  type Evidence,
} from "../../../packages/core/evidence";
import type { ResourceTarget } from "../../../packages/core/resources";
import { useModules } from "./modules/ModuleProvider";
import ModuleDialog from "./modules/ModuleDialog";

export default function ConnectionEvidence({
  relation,
  vault,
  onChange,
  onClose,
  onOpenNote,
  onOpenResource,
}: {
  relation: Relation;
  vault: VaultSnapshot;
  onChange(evidence: Evidence[]): void;
  onClose(): void;
  onOpenNote(evidence: Extract<Evidence, { kind: "note" }>): void;
  onOpenResource(target: ResourceTarget): void;
}) {
  const { snapshot } = useModules(),
    state = snapshot?.state;
  const [source, setSource] = useState("note"),
    [noteId, setNoteId] = useState(vault.notes[0]?.id ?? ""),
    [quote, setQuote] = useState(""),
    [annotation, setAnnotation] = useState(""),
    [error, setError] = useState("");
  const note = vault.notes.find((n) => n.id === noteId),
    existing = relation.evidence ?? [];
  const add = () => {
    try {
      let evidence: Evidence;
      if (source === "note") {
        if (!note) throw new Error("Choose a saved note.");
        evidence = noteEvidence(note, quote);
      } else {
        const doc = state?.documents.find((d) =>
            d.annotations.some((a) => a.id === annotation),
          ),
          a = doc?.annotations.find((a) => a.id === annotation);
        if (!doc || !a) throw new Error("Choose a PDF annotation.");
        evidence = pdfEvidence(doc, a);
      }
      if (existing.length >= 100)
        throw new Error("This connection already has 100 evidence items.");
      onChange([...existing, evidence]);
      setError("");
      setQuote("");
    } catch (e) {
      setError(String(e));
    }
  };
  return (
    <ModuleDialog label="Connection evidence" onClose={onClose}>
      <div className="evidence-dialog module-form">
        <h2>Evidence for “{relation.kind}”</h2>
        <p>
          Keep the exact passage or PDF annotation behind this relationship.
          Source changes are flagged for review.
        </p>
        <div className="evidence-list">
          {existing.map((e) => {
            const status = state
              ? evidenceStatus(e, vault.notes, state)
              : "missing";
            return (
              <article className="evidence-item" key={e.id}>
                <div>
                  <strong>
                    {e.kind === "note"
                      ? (vault.notes.find((n) => n.id === e.noteId)?.title ??
                        "Missing note")
                      : `PDF · page ${e.page}`}
                  </strong>
                  <span className={"evidence-status " + status}>
                    {status === "current"
                      ? "Source current"
                      : status === "changed"
                        ? "Source changed · review"
                        : "Source missing"}
                  </span>
                </div>
                <blockquote>{e.quote}</blockquote>
                <div className="evidence-actions">
                  <button
                    onClick={() => {
                      if (e.kind === "note") onOpenNote(e);
                      else
                        onOpenResource({
                          kind: "pdf",
                          id: e.documentId,
                          annotationId: e.annotationId,
                          page: e.page,
                        });
                      onClose();
                    }}
                  >
                    Open evidence source
                  </button>
                  {status === "changed" && (
                    <button
                      onClick={() => {
                        try {
                          let next: Evidence;
                          if (e.kind === "note") {
                            const n = vault.notes.find(
                              (n) => n.id === e.noteId,
                            )!;
                            const start = n.content.indexOf(e.quote);
                            if (
                              start < 0 ||
                              n.content.indexOf(e.quote, start + 1) >= 0
                            )
                              throw new Error(
                                "The original passage is missing or ambiguous. Remove this evidence and attach the intended passage again.",
                              );
                            next = noteEvidence(n, e.quote, start);
                          } else {
                            const doc = state!.documents.find(
                              (d) => d.id === e.documentId,
                            )!;
                            if (doc.fingerprint !== e.fingerprint)
                              throw new Error(
                                "The PDF file changed. Inspect it and attach a new annotation.",
                              );
                            next = pdfEvidence(
                              doc,
                              doc.annotations.find(
                                (a) => a.id === e.annotationId,
                              )!,
                            );
                          }
                          onChange(
                            existing.map((old) =>
                              old.id === e.id ? { ...next, id: e.id } : old,
                            ),
                          );
                          setError("");
                        } catch (err) {
                          setError(String(err));
                        }
                      }}
                    >
                      Confirm reviewed source
                    </button>
                  )}
                  <button
                    aria-label="Remove evidence"
                    onClick={() =>
                      onChange(existing.filter((old) => old.id !== e.id))
                    }
                  >
                    Remove
                  </button>
                </div>
              </article>
            );
          })}
          {!existing.length && <p>No evidence attached yet.</p>}
        </div>
        <label>
          Evidence source
          <select
            aria-label="Evidence source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="note">Saved note passage</option>
            <option value="pdf">PDF annotation</option>
          </select>
        </label>
        {source === "note" ? (
          <>
            <label>
              Source note
              <select
                aria-label="Evidence note"
                value={noteId}
                onChange={(e) => {
                  setNoteId(e.target.value);
                  setQuote("");
                }}
              >
                {vault.notes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.path}
                  </option>
                ))}
              </select>
            </label>
            <details>
              <summary>Read saved source</summary>
              <pre className="evidence-source-preview">{note?.content}</pre>
            </details>
            <label>
              Exact passage
              <textarea
                aria-label="Evidence passage"
                value={quote}
                maxLength={10000}
                onChange={(e) => setQuote(e.target.value)}
                placeholder="Paste the exact passage from the saved note"
              />
            </label>
          </>
        ) : (
          <label>
            Annotation
            <select
              aria-label="Evidence annotation"
              value={annotation}
              onChange={(e) => setAnnotation(e.target.value)}
            >
              <option value="">Choose an annotation</option>
              {state?.documents.flatMap((d) =>
                d.annotations.map((a) => (
                  <option key={a.id} value={a.id}>
                    {d.path.split("/").pop()} · p{a.page} ·{" "}
                    {(a.quote || a.comment || a.kind).slice(0, 90)}
                  </option>
                )),
              )}
            </select>
          </label>
        )}
        {error && (
          <p className="module-error" role="alert">
            {error}
          </p>
        )}
        <footer>
          <button onClick={onClose}>Close</button>
          <button className="primary" onClick={add}>
            Attach evidence
          </button>
        </footer>
      </div>
    </ModuleDialog>
  );
}
