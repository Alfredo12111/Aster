import type { VaultSnapshot } from "../../../packages/core/types";
import {
  resourceNotes,
  resourceEdges,
  type ResourceTarget,
} from "../../../packages/core/resources";
import { useModules } from "./modules/ModuleProvider";
export default function ToolConnections({
  vault,
  noteId,
  onOpen,
  onEvidence,
}: {
  vault: VaultSnapshot;
  noteId: string;
  onOpen(target: ResourceTarget): void;
  onEvidence(id: string): void;
}) {
  const { snapshot } = useModules();
  if (!snapshot) return null;
  const state = snapshot.state,
    resources = resourceNotes(state, vault.notes),
    ids = new Set(resources.map((n) => n.id));
  const edges = [
    ...vault.settings.relations.map((r) => ({ ...r, origin: "manual" })),
    ...resourceEdges(state, vault.notes),
  ].filter(
    (e) =>
      (e.source === noteId && ids.has(e.target)) ||
      (e.target === noteId && ids.has(e.source)),
  );
  if (!edges.length) return null;
  return (
    <section className="control-section">
      <span className="section-label">CONNECTED TOOLS</span>
      {edges.map((e) => {
        const id = e.source === noteId ? e.target : e.source,
          pin = state.resources.find((p) => p.id === id);
        return (
          <div className="connection-item" key={e.id}>
            <button onClick={() => pin && onOpen(pin.target)}>
              <div>
                <strong>{resources.find((r) => r.id === id)?.title}</strong>
                <small>{e.kind}</small>
              </div>
            </button>
            {e.origin === "manual" && (
              <button onClick={() => onEvidence(e.id)}>
                Evidence ({e.evidence?.length ?? 0})
              </button>
            )}
          </div>
        );
      })}
    </section>
  );
}
