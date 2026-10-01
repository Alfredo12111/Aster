import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Plus,
  CalendarDays,
} from "lucide-react";
import {
  addDays,
  dateObject,
  localDate,
  monthDates,
  weekDates,
} from "../../../../packages/core/modules";
import { noteMetadata } from "../../../../packages/core/metadata";
import type { VaultSnapshot } from "../../../../packages/core/types";
import type { ModuleProps } from "./ModuleHost";
export default function CalendarModule({
  vault,
  state,
  commit,
  onOpen,
  onVault,
}: ModuleProps & { onVault(vault: VaultSnapshot): void }) {
  const [date, setDate] = useState(localDate()),
    [mode, setMode] = useState<"month" | "week" | "day">("month"),
    [error, setError] = useState(""),
    [working, setWorking] = useState(false);
  const [folder, setFolder] = useState(state.calendar.dailyFolder);
  const index = useMemo(() => {
    const map = new Map<string, typeof vault.notes>();
    for (const n of vault.notes) {
      const day = noteMetadata(n).date;
      if (typeof day === "string") {
        const items = map.get(day) ?? [];
        items.push(n);
        map.set(day, items);
      }
    }
    return map;
  }, [vault.notes]);
  const days =
    mode === "month"
      ? monthDates(date, state.calendar.weekStartsOn)
      : mode === "week"
        ? weekDates(date, state.calendar.weekStartsOn)
        : [date];
  const tasks = state.enabled.tasks
    ? state.tasks.filter((t) => t.due === date)
    : [];
  const shift = (amount: number) => {
    if (mode === "month") {
      const d = dateObject(date);
      d.setDate(1);
      d.setMonth(d.getMonth() + amount);
      setDate(localDate(d));
    } else setDate(addDays(date, amount * (mode === "week" ? 7 : 1)));
  };
  const daily = async () => {
    setWorking(true);
    setError("");
    try {
      const result = await window.aster.openDailyNote({
        vaultId: vault.id,
        date,
      });
      onVault(result.vault);
      onOpen(result.noteId);
    } catch (e) {
      setError(String(e));
    } finally {
      setWorking(false);
    }
  };
  return (
    <div className="calendar-module module-page">
      <header className="module-page-heading">
        <div>
          <span className="eyebrow">MAKE ROOM FOR THE DAY</span>
          <h1>Calendar</h1>
        </div>
        <div className="module-toolbar">
          <button className="quiet-button" onClick={() => setDate(localDate())}>
            Today
          </button>
          <button title="Previous calendar period" onClick={() => shift(-1)}>
            <ChevronLeft size={18} />
          </button>
          <button title="Next calendar period" onClick={() => shift(1)}>
            <ChevronRight size={18} />
          </button>
          <input
            aria-label="Calendar date"
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </div>
      </header>
      <div className="calendar-subheader">
        <h2>
          {dateObject(date).toLocaleDateString(undefined, {
            month: "long",
            year: "numeric",
          })}
        </h2>
        <div className="segmented">
          {(["day", "week", "month"] as const).map((v) => (
            <button
              key={v}
              className={mode === v ? "active" : ""}
              onClick={() => setMode(v)}
            >
              {v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="calendar-body">
        <div className={`calendar-grid calendar-${mode}`}>
          {mode !== "day" &&
            weekDates(date, state.calendar.weekStartsOn).map((d) => (
              <div className="calendar-weekday" key={"h" + d}>
                {dateObject(d).toLocaleDateString(undefined, {
                  weekday: "short",
                })}
              </div>
            ))}
          {days.map((d) => {
            const notes = index.get(d) ?? [],
              due = state.enabled.tasks
                ? state.tasks.filter(
                    (t) => t.due === d && t.status !== "cancelled",
                  )
                : [];
            return (
              <button
                key={d}
                className={`calendar-cell ${d === date ? "selected" : ""} ${d === localDate() ? "today" : ""} ${d.slice(0, 7) !== date.slice(0, 7) ? "outside" : ""}`}
                aria-label={`Choose ${d}`}
                onClick={() => setDate(d)}
                onDoubleClick={() => {
                  setDate(d);
                  setMode("day");
                }}
              >
                <span className="calendar-day-number">
                  {dateObject(d).getDate()}
                </span>
                {mode === "day" && (
                  <strong>
                    {dateObject(d).toLocaleDateString(undefined, {
                      weekday: "long",
                    })}
                  </strong>
                )}
                {notes.slice(0, mode === "month" ? 2 : 12).map((n) => (
                  <span className="calendar-note" key={n.id}>
                    <FileText size={11} />
                    {n.title}
                  </span>
                ))}
                {due.slice(0, mode === "month" ? 1 : 12).map((t) => (
                  <span
                    className={`calendar-task ${t.status === "done" ? "completed" : ""}`}
                    key={t.id}
                  >
                    {t.status === "done" ? "✓" : "○"} {t.title}
                  </span>
                ))}
                {notes.length + due.length > (mode === "month" ? 3 : 24) && (
                  <small>
                    {notes.length} notes · {due.length} tasks
                  </small>
                )}
              </button>
            );
          })}
        </div>
        <aside className="calendar-agenda">
          <CalendarDays size={22} />
          <h2>
            {dateObject(date).toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </h2>
          <button
            className="primary full"
            disabled={working}
            onClick={() => void daily()}
          >
            <Plus size={14} />
            Open or create daily note
          </button>
          <h3>Notes on this date</h3>
          {!index.get(date)?.length && (
            <p className="muted">No dated notes yet.</p>
          )}
          {index.get(date)?.map((n) => (
            <button
              className="agenda-item"
              key={n.id}
              onClick={() => onOpen(n.id)}
            >
              <FileText size={14} />
              {n.title}
            </button>
          ))}
          {state.enabled.tasks && (
            <>
              <h3>Due on this date</h3>
              {!tasks.length && <p className="muted">Nothing due.</p>}
              {tasks.map((t) => (
                <div className="agenda-item" key={t.id}>
                  <input
                    aria-label={`Complete ${t.title}`}
                    type="checkbox"
                    checked={t.status === "done"}
                    onChange={(e) => {
                      const done = e.target.checked;
                      void commit((s) => {
                        const task = s.tasks.find((x) => x.id === t.id)!;
                        task.status = done ? "done" : "todo";
                        task.updatedAt = Date.now();
                      }).catch(() => {});
                    }}
                  />
                  <span>{t.title}</span>
                </div>
              ))}
            </>
          )}
          <details className="module-details">
            <summary>Calendar settings</summary>
            <label>
              Daily note folder
              <input
                aria-label="Daily note folder"
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
              />
            </label>
            <button
              className="quiet-button"
              onClick={() =>
                void commit((s) => {
                  s.calendar.dailyFolder = folder;
                }).catch(() => {})
              }
            >
              Save calendar settings
            </button>
            <label>
              Week starts
              <select
                aria-label="Week starts"
                value={state.calendar.weekStartsOn}
                onChange={(e) => {
                  const first = +e.target.value as 0 | 1;
                  void commit((s) => {
                    s.calendar.weekStartsOn = first;
                  }).catch(() => {});
                }}
              >
                <option value={1}>Monday</option>
                <option value={0}>Sunday</option>
              </select>
            </label>
          </details>
          <p className="muted">
            Notes appear here through their <code>date</code> frontmatter field.
          </p>
          {error && (
            <p role="alert" className="module-error">
              {error}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
