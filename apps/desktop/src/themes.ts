import type { ThemeName } from "../../../packages/core/workspace";
import { legacyColors } from "./theme-colors";
export const themes: Record<
  ThemeName,
  {
    name: string;
    description: string;
    light: boolean;
    bg: string;
    side: string;
    panel: string;
    text: string;
    muted: string;
    line: string;
    accent: string;
    secondary: string;
    onAccent: string;
  }
> = {
  aster: {
    name: "Aster",
    description: "Charcoal, warm amber, familiar focus.",
    light: false,
    bg: "#17191b",
    side: "#1c1e20",
    panel: "#22252a",
    text: "#e5e6e9",
    muted: "#92969e",
    line: "#353941",
    accent: "#e6bb78",
    secondary: "#81a9d8",
    onAccent: "#211b13",
  },
  cyber: {
    name: "Cyber",
    description: "Electric green on deep black.",
    light: false,
    bg: "#080d0b",
    side: "#0b1410",
    panel: "#102019",
    text: "#dcfbe8",
    muted: "#84b797",
    line: "#254c34",
    accent: "#63f593",
    secondary: "#30d9b5",
    onAccent: "#08140d",
  },
  lavender: {
    name: "Lavender",
    description: "Soft gray, quiet purple, a calmer desk.",
    light: true,
    bg: "#f2f0f7",
    side: "#e9e5f0",
    panel: "#faf8fd",
    text: "#332b45",
    muted: "#71687e",
    line: "#d3cbdF",
    accent: "#7953ad",
    secondary: "#567da5",
    onAccent: "#ffffff",
  },
  ocean: {
    name: "Deep Ocean",
    description: "Midnight blue and clear cyan.",
    light: false,
    bg: "#101b29",
    side: "#142234",
    panel: "#1a2b40",
    text: "#e1edf8",
    muted: "#91a9c1",
    line: "#314a65",
    accent: "#66c8ed",
    secondary: "#a6a0f1",
    onAccent: "#0e2130",
  },
  paper: {
    name: "Paper",
    description: "Warm ivory and ink for long writing sessions.",
    light: true,
    bg: "#f7f3e9",
    side: "#eee7d8",
    panel: "#fffdf7",
    text: "#39352e",
    muted: "#777065",
    line: "#d7cebc",
    accent: "#886237",
    secondary: "#477b78",
    onAccent: "#ffffff",
  },
  rose: {
    name: "Rosewood",
    description: "Plum shadows with a soft rose accent.",
    light: false,
    bg: "#241e25",
    side: "#2c2330",
    panel: "#342a37",
    text: "#f3e6ee",
    muted: "#b99dad",
    line: "#574252",
    accent: "#eba5c2",
    secondary: "#b5a2e3",
    onAccent: "#321e29",
  },
};
function rgb(hex: string) {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
function blend(a: string, b: string, t: number) {
  const x = rgb(a),
    y = rgb(b);
  return (
    "#" +
    x
      .map((v, i) =>
        Math.round(v + (y[i] - v) * Math.max(0, Math.min(1, t)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
function tone(original: string, theme: typeof themes.aster) {
  let full = original.slice(1);
  if (full.length === 3 || full.length === 4)
    full = [...full].map((c) => c + c).join("");
  const alpha = full.slice(6),
    color = "#" + full.slice(0, 6),
    [r, g, b] = rgb(color).map((v) => v / 255),
    max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    light = (max + min) / 2,
    saturation = max ? (max - min) / max : 0;
  let mapped: string;
  if (light < 0.29)
    mapped = blend(theme.bg, theme.line, Math.max(0, (light - 0.08) / 0.22));
  else if (saturation < 0.2)
    mapped = blend(theme.muted, theme.text, (light - 0.4) / 0.5);
  else if (r > g * 1.08 && g > b * 1.1) mapped = theme.accent;
  else if (b > r * 1.12) mapped = theme.secondary;
  else if (r > g * 1.15) mapped = theme.light ? "#a33b63" : "#eb8cae";
  else if (g > r * 1.08) mapped = theme.light ? "#32795a" : "#81c9a6";
  else mapped = theme.accent;
  return mapped + alpha;
}
export function applyTheme(name: ThemeName) {
  const theme = themes[name],
    root = document.documentElement;
  root.dataset.theme = name;
  root.style.colorScheme = theme.light ? "light" : "dark";
  for (const [key, value] of Object.entries({
    bg: theme.bg,
    side: theme.side,
    panel: theme.panel,
    text: theme.text,
    muted: theme.muted,
    line: theme.line,
    accent: theme.accent,
    "on-accent": theme.onAccent,
    "menu-bg": theme.light ? theme.text : theme.panel,
    "menu-text": theme.light ? theme.panel : theme.text,
  }))
    root.style.setProperty("--" + key, value);
  for (const hex of legacyColors)
    root.style.setProperty(
      "--tone-" + hex.slice(1),
      name === "aster" ? hex : tone(hex, theme),
    );
  root.style.color = theme.text;
  root.style.background = theme.bg;
  window.dispatchEvent(new Event("aster-theme"));
}
