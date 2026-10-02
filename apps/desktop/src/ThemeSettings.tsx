import { useState } from "react";
import { Check } from "lucide-react";
import { themes } from "./themes";
import { themeNames } from "../../../packages/core/workspace";
import { useModules } from "./modules/ModuleProvider";
export default function ThemeSettings() {
  const { snapshot, commit, pending } = useModules(),
    [error, setError] = useState("");
  return (
    <div className="theme-settings">
      <p>
        Choose the atmosphere for this vault. Notes, documents, and your custom
        graph colors stay yours.
      </p>
      <div className="theme-grid">
        {themeNames.map((id) => {
          const theme = themes[id],
            selected = snapshot?.state.workspace.theme === id;
          return (
            <button
              type="button"
              key={id}
              className={"theme-card " + (selected ? "selected" : "")}
              aria-pressed={selected}
              aria-label={"Use " + theme.name + " theme"}
              disabled={pending > 0}
              onClick={() =>
                void commit((s) => {
                  s.workspace.theme = id;
                }).catch((e) => setError(String(e)))
              }
            >
              <span
                className="theme-preview"
                style={{ background: theme.bg, borderColor: theme.line }}
              >
                <i style={{ background: theme.side }} />
                <span>
                  <b style={{ background: theme.accent }} />
                  <b style={{ background: theme.text }} />
                  <b style={{ background: theme.muted }} />
                </span>
              </span>
              <strong>
                {theme.name}
                {selected && <Check size={14} />}
              </strong>
              <small>{theme.description}</small>
            </button>
          );
        })}
      </div>
      {error && <p role="alert">{error}</p>}
      <p className="control-hint">
        Applied immediately and saved with this vault.
      </p>
    </div>
  );
}
