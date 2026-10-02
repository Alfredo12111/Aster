import { contextBridge, ipcRenderer } from "electron";
import type { AsterApi } from "../../../packages/core/types";
const api: AsterApi = {
  load: () => ipcRenderer.invoke("vault:load"),
  openVault: () => ipcRenderer.invoke("vault:open"),
  createVault: () => ipcRenderer.invoke("vault:create"),
  saveNote: (input) => ipcRenderer.invoke("note:save", input),
  createNote: (input) => ipcRenderer.invoke("note:create", input),
  createFolder: (input) => ipcRenderer.invoke("folder:create", input),
  moveNote: (input) => ipcRenderer.invoke("note:move", input),
  trashNote: (input) => ipcRenderer.invoke("note:trash", input),
  saveSettings: (input) => ipcRenderer.invoke("settings:save", input),
  exportRag: () => ipcRenderer.invoke("rag:export"),
  exportAsset: (input) => ipcRenderer.invoke("asset:export", input),
  onModulesChanged: (callback) => {
    ipcRenderer.on("modules:changed", callback);
    return () => ipcRenderer.removeListener("modules:changed", callback);
  },
  revealVault: () => ipcRenderer.invoke("vault:reveal"),
  aiSettings: () => ipcRenderer.invoke("ai:settings"),
  saveAiSettings: (input) => ipcRenderer.invoke("ai:save", input),
  suggestAi: (input) => ipcRenderer.invoke("ai:suggest", input),
  onVaultChanged: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("vault:changed", listener);
    return () => ipcRenderer.removeListener("vault:changed", listener);
  },
  loadModules: () => ipcRenderer.invoke("modules:load"),
  saveModules: (input) => ipcRenderer.invoke("modules:save", input),
  openDailyNote: (input) => ipcRenderer.invoke("calendar:daily", input),
  importPdf: () => ipcRenderer.invoke("pdf:import"),
  readPdf: (input) => ipcRenderer.invoke("pdf:read", input),
};
contextBridge.exposeInMainWorld("aster", api);
