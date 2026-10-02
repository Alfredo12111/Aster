import type { ModuleSnapshot, ModuleState } from "./modules";
import type { Evidence } from "./evidence";
export type Note = {
  id: string;
  path: string;
  title: string;
  content: string;
  revision: string;
  modifiedAt: number;
  tags: string[];
  metadata?: Record<string, unknown>;
  metadataError?: string;
};
export type Point = { x: number; y: number };
export type Relation = {
  id: string;
  source: string;
  target: string;
  kind: string;
  evidence?: Evidence[];
};
export type GraphEdge = Relation & {
  origin: "wikilink" | "manual" | "resource";
};
export type GraphView = {
  id: string;
  name: string;
  positions: Record<string, Point>;
  layout: "cluster" | "radial" | "force";
  filter: string;
};
export type VaultSettings = {
  views: GraphView[];
  activeView: string;
  colors: Record<string, string>;
  noteColors: Record<string, string>;
  relations: Relation[];
  nodeSize: number;
  linkOpacity: number;
  showLabels: boolean;
  showArrows: boolean;
};
export type VaultSnapshot = {
  id: string;
  name: string;
  root: string;
  notes: Note[];
  folders: string[];
  settings: VaultSettings;
};
export type Suggestion = {
  noteId: string;
  score: number;
  reason: string;
  origin: "local" | "ai";
};
export type AiSettings = {
  provider: "openai" | "anthropic";
  model: string;
  hasKey: boolean;
};
export type AsterApi = {
  load(): Promise<VaultSnapshot>;
  openVault(): Promise<VaultSnapshot | null>;
  createVault(): Promise<VaultSnapshot | null>;
  saveNote(input: {
    id: string;
    content: string;
    revision: string;
  }): Promise<Note>;
  createNote(path: string): Promise<VaultSnapshot>;
  createFolder(path: string): Promise<VaultSnapshot>;
  moveNote(input: { id: string; path: string }): Promise<VaultSnapshot>;
  trashNote(id: string): Promise<VaultSnapshot>;
  saveSettings(settings: VaultSettings): Promise<void>;
  exportRag(): Promise<string | null>;
  exportAsset(input: {
    name: string;
    format: "png" | "svg" | "csv" | "xlsx";
    data: string;
  }): Promise<string | null>;
  onModulesChanged(callback: () => void): () => void;
  revealVault(): Promise<void>;
  aiSettings(): Promise<AiSettings>;
  saveAiSettings(settings: {
    provider: "openai" | "anthropic";
    model: string;
    key?: string;
  }): Promise<AiSettings>;
  suggestAi(id: string): Promise<Suggestion[]>;
  onVaultChanged(callback: () => void): () => void;
  loadModules(): Promise<ModuleSnapshot>;
  saveModules(input: {
    vaultId: string;
    revision: string;
    state: ModuleState;
  }): Promise<ModuleSnapshot>;
  openDailyNote(input: {
    vaultId: string;
    date: string;
  }): Promise<{ vault: VaultSnapshot; noteId: string }>;
  importPdf(): Promise<ModuleSnapshot | null>;
  readPdf(input: {
    vaultId: string;
    documentId: string;
  }): Promise<{ data: Uint8Array; fingerprint: string }>;
};
export const PALETTE = [
  "#e6bb78",
  "#79bfb0",
  "#aa9ad8",
  "#df8b97",
  "#81a9d8",
  "#b7c879",
];
export const defaultSettings = (): VaultSettings => ({
  views: [
    {
      id: "default",
      name: "My constellation",
      positions: {},
      layout: "cluster",
      filter: "",
    },
  ],
  activeView: "default",
  colors: {},
  noteColors: {},
  relations: [],
  nodeSize: 7,
  linkOpacity: 35,
  showLabels: true,
  showArrows: false,
});
export const folderOf = (path: string) =>
  path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
export const groupOf = (path: string) =>
  path.includes("/") ? path.split("/")[0] : "Unfiled";
export const extractTags = (content: string) => [
  ...new Set(
    [...content.matchAll(/(?:^|\s)#([\p{L}\p{N}_/-]+)/gu)].map((x) => x[1]),
  ),
];
export function titleOf(path: string) {
  return path.split("/").pop()!.replace(/\.md$/i, "");
}
