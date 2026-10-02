import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import * as fs from "node:fs/promises";
import { watch, type FSWatcher } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import {
  VaultRepository,
  atomicWrite,
  settingsSchema,
} from "../../../packages/storage-fs/vault";
import { exportChunks } from "../../../packages/core/rag";
import { AiService } from "./ai";
import { moduleStateSchema, dateSchema } from "../../../packages/core/modules";

if (process.env.ASTER_USER_DATA)
  app.setPath("userData", path.resolve(process.env.ASTER_USER_DATA));
app.setName("Aster");
const ownsLock = app.requestSingleInstanceLock();
if (!ownsLock) app.quit();
let window: BrowserWindow | null = null,
  repo: VaultRepository,
  watcher: FSWatcher | undefined,
  timer: ReturnType<typeof setTimeout>;
let operations: Promise<unknown> = Promise.resolve();
const enqueue = <T>(work: () => Promise<T>) => {
  const result = operations.then(work);
  operations = result.catch(() => {});
  return result;
};
const devUrl =
  !app.isPackaged && process.env.ASTER_DEV_URL === "http://127.0.0.1:5173"
    ? process.env.ASTER_DEV_URL
    : undefined;
const renderer = path.resolve(__dirname, "../dist/index.html");
const trustedUrl = devUrl ?? pathToFileURL(renderer).href;
const configFile = () => path.join(app.getPath("userData"), "workspace.json");

function handle(channel: string, fn: (payload: any) => unknown, serial = true) {
  ipcMain.handle(channel, (event, payload) => {
    if (
      event.sender !== window?.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      event.senderFrame.url.split("#")[0].replace(/\/$/, "") !==
        trustedUrl.replace(/\/$/, "")
    )
      throw new Error("Untrusted application frame.");
    const invoke = async () => {
      try {
        return await fn(payload);
      } catch (e) {
        throw new Error(
          e instanceof z.ZodError
            ? "Invalid input."
            : e instanceof Error
              ? e.message
              : "The operation failed.",
        );
      }
    };
    return serial ? enqueue(invoke) : invoke();
  });
}
async function useVault(root: string, seed = false) {
  const next = new VaultRepository(root);
  const snapshot = await next.initialize(seed);
  await atomicWrite(configFile(), JSON.stringify({ root: next.root }));
  watcher?.close();
  repo = next;
  watcher = watch(root, { recursive: true }, (_event, name) => {
    if (name?.endsWith("modules.json")) {
      window?.webContents.send("modules:changed");
      return;
    }
    if (
      name &&
      ((name.startsWith(".aster") && !name.endsWith("modules.json")) ||
        name.endsWith(".tmp"))
    )
      return;
    clearTimeout(timer);
    timer = setTimeout(() => window?.webContents.send("vault:changed"), 900);
  });
  watcher.on("error", () => window?.webContents.send("vault:changed"));
  return snapshot;
}
async function boot() {
  await app.whenReady();
  await fs.mkdir(app.getPath("userData"), { recursive: true });
  let root = process.env.ASTER_INITIAL_VAULT;
  if (!root)
    try {
      root = JSON.parse(await fs.readFile(configFile(), "utf8")).root;
    } catch {}
  root ??= path.join(app.getPath("userData"), "Aster Welcome");
  const ai = new AiService(app.getPath("userData"));
  // Keep startup errors in the app so a missing external drive does not destroy workspace settings.
  let startupError: unknown;
  try {
    await useVault(
      root,
      !process.env.ASTER_INITIAL_VAULT && root.endsWith("Aster Welcome"),
    );
  } catch (e) {
    startupError = e;
  }
  handle("vault:load", async () => {
    if (!repo) throw startupError;
    return repo.snapshot();
  });
  handle("vault:open", async () => {
    const result = await dialog.showOpenDialog(window!, {
      title: "Open a Markdown vault",
      properties: ["openDirectory"],
    });
    return result.canceled ? null : useVault(result.filePaths[0]);
  });
  handle("vault:create", async () => {
    const result = await dialog.showSaveDialog(window!, {
      title: "Create a vault folder",
      defaultPath: path.join(app.getPath("documents"), "My Aster Vault"),
      buttonLabel: "Create vault",
    });
    if (result.canceled || !result.filePath) return null;
    try {
      await fs.access(result.filePath);
      throw new Error("That folder already exists. Use Open vault instead.");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    return useVault(result.filePath);
  });
  handle("note:save", (data) =>
    repo.saveNote(
      z
        .object({
          id: z.string().uuid(),
          content: z.string().max(2_000_000),
          revision: z.string().length(64),
        })
        .parse(data),
    ),
  );
  handle("note:create", (data) =>
    repo.createNote(z.string().min(1).max(400).parse(data)),
  );
  handle("folder:create", (data) =>
    repo.createFolder(z.string().min(1).max(400).parse(data)),
  );
  handle("note:move", (data) =>
    repo.moveNote(
      z
        .object({ id: z.string().uuid(), path: z.string().min(1).max(400) })
        .parse(data),
    ),
  );
  handle("note:trash", (data) => repo.trashNote(z.string().uuid().parse(data)));
  handle("settings:save", (data) =>
    repo.saveSettings(settingsSchema.parse(data)),
  );
  handle("vault:reveal", () => shell.openPath(repo.root));
  handle("rag:export", async () => {
    const result = await dialog.showSaveDialog(window!, {
      title: "Export source-attributed RAG chunks",
      defaultPath: `${path.basename(repo.root)}-rag.jsonl`,
      filters: [{ name: "JSON Lines", extensions: ["jsonl"] }],
    });
    if (result.canceled || !result.filePath) return null;
    const chunks = exportChunks(await repo.snapshot());
    await atomicWrite(
      result.filePath,
      chunks.map((c) => JSON.stringify(c)).join("\n") + "\n",
    );
    return result.filePath;
  });
  handle("ai:settings", () => ai.settings());
  handle("asset:export", async (data) => {
    const input = z
      .object({
        name: z.string().max(200),
        format: z.enum(["png", "svg", "csv", "xlsx"]),
        data: z.string().max(30_000_000),
      })
      .parse(data);
    let bytes: Buffer;
    if (input.format === "png") {
      if (!input.data.startsWith("data:image/png;base64,"))
        throw new Error("Invalid PNG data.");
      bytes = Buffer.from(input.data.slice(22), "base64");
      if (bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a")
        throw new Error("Invalid PNG file.");
    } else if (input.format === "xlsx") {
      bytes = Buffer.from(input.data, "base64");
      if (bytes.subarray(0, 4).toString("hex") !== "504b0304")
        throw new Error("Invalid workbook.");
    } else bytes = Buffer.from(input.data, "utf8");
    const name =
      input.name
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
        .replace(/[. ]+$/, "")
        .slice(0, 100) || "Aster export";
    const result = await dialog.showSaveDialog(window!, {
      title: "Export " + input.format.toUpperCase(),
      defaultPath: name + "." + input.format,
      filters: [
        { name: input.format.toUpperCase(), extensions: [input.format] },
      ],
    });
    if (result.canceled || !result.filePath) return null;
    if (path.extname(result.filePath).toLowerCase() !== "." + input.format)
      throw new Error("Use the ." + input.format + " file extension.");
    const temp = result.filePath + "." + crypto.randomUUID() + ".tmp";
    try {
      await fs.writeFile(temp, bytes, { flag: "wx" });
      await fs.rename(temp, result.filePath);
    } finally {
      await fs.rm(temp, { force: true });
    }
    return result.filePath;
  });
  handle("ai:save", (data) => ai.save(data));
  handle(
    "ai:suggest",
    async (data) =>
      ai.suggest(await repo.snapshot(), z.string().uuid().parse(data)),
    false,
  );
  handle("modules:load", () => repo.loadModules());
  handle("modules:save", (data) =>
    repo.saveModules(
      z
        .object({
          vaultId: z.string().uuid(),
          revision: z.string().length(64),
          state: moduleStateSchema,
        })
        .parse(data),
    ),
  );
  handle("calendar:daily", (data) =>
    repo.openDailyNote(
      z.object({ vaultId: z.string().uuid(), date: dateSchema }).parse(data),
    ),
  );
  handle("pdf:import", async () => {
    const result = await dialog.showOpenDialog(window!, {
      title: "Add a PDF to this vault",
      properties: ["openFile"],
      filters: [{ name: "PDF documents", extensions: ["pdf"] }],
    });
    return result.canceled ? null : repo.importPdf(result.filePaths[0]);
  });
  handle("pdf:read", (data) =>
    repo.readPdf(
      z
        .object({ vaultId: z.string().uuid(), documentId: z.string().uuid() })
        .parse(data),
    ),
  );
  window = new BrowserWindow({
    width: 1540,
    height: 980,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: "#17191b",
    title: "Aster",
    icon: path.resolve(__dirname, "../dist/icon.png"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (url !== trustedUrl) event.preventDefault();
  });
  window.webContents.session.setPermissionRequestHandler((_wc, _p, callback) =>
    callback(false),
  );
  window.webContents.on("will-prevent-unload", (event) => {
    const choice = dialog.showMessageBoxSync(window!, {
      type: "warning",
      buttons: ["Keep editing", "Close without saving"],
      defaultId: 0,
      cancelId: 0,
      title: "Unsaved changes",
      message: "Some changes have not been saved. Close anyway?",
    });
    if (choice === 1) event.preventDefault();
  });
  if (devUrl) await window.loadURL(devUrl);
  else await window.loadFile(renderer);
  window.on("closed", () => {
    window = null;
  });
}
app.on("second-instance", () => {
  window?.restore();
  window?.focus();
});
app.on("window-all-closed", () => {
  watcher?.close();
  clearTimeout(timer);
  app.quit();
});
if (ownsLock)
  boot().catch((error) => {
    dialog.showErrorBox("Aster could not start", error.message);
    app.quit();
  });
