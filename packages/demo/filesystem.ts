import * as fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { makeDemo, type PdfSource } from "./pelagic";
import { localDate, dateSchema } from "../core/modules";
import { settingsSchema } from "../storage-fs/vault";

export async function readDemoSources(
  assetDirectory: string,
): Promise<PdfSource[]> {
  const sources = JSON.parse(
    await fs.readFile(path.join(assetDirectory, "sources.json"), "utf8"),
  ) as Omit<PdfSource, "data">[];
  return Promise.all(
    sources.map(async (source) => {
      if (!/^[a-z-]+\.pdf$/.test(source.file))
        throw new Error("Invalid bundled report path.");
      return {
        ...source,
        data: await fs.readFile(path.join(assetDirectory, source.file)),
      };
    }),
  );
}

// Create in a sibling staging directory. A partial copy never becomes the active vault.
// The destination must be absent; this function never updates an existing vault.
export async function createDemoVault(
  destination: string,
  assetDirectory: string,
  date = localDate(),
) {
  const root = path.resolve(destination),
    parent = path.dirname(root);
  dateSchema.parse(date);
  try {
    await fs.lstat(root);
    throw new Error(
      "The demo destination already exists; its contents were preserved.",
    );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  const sources = await readDemoSources(assetDirectory),
    demo = makeDemo(date, sources);
  settingsSchema.parse(demo.settings);
  await fs.mkdir(parent, { recursive: true });
  const staging = await fs.mkdtemp(path.join(parent, ".pelagic-staging-"));
  try {
    await fs.mkdir(path.join(staging, ".aster"));
    await fs.mkdir(path.join(staging, "Attachments"));
    for (const note of demo.notes) {
      const target = path.resolve(staging, note.path);
      if (!target.startsWith(staging + path.sep))
        throw new Error("Invalid demo note path.");
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, note.content, { flag: "wx" });
    }
    for (const source of sources)
      await fs.writeFile(
        path.join(staging, "Attachments", source.file),
        source.data,
        { flag: "wx" },
      );
    const manifest = {
      version: 1,
      id: randomUUID(),
      noteIds: Object.fromEntries(demo.notes.map((n) => [n.path, n.id])),
      settings: demo.settings,
    };
    await fs.writeFile(
      path.join(staging, ".aster", "vault.json"),
      JSON.stringify(manifest, null, 2),
    );
    await fs.writeFile(
      path.join(staging, ".aster", "modules.json"),
      JSON.stringify(demo.state, null, 2),
    );
    await fs.writeFile(
      path.join(staging, ".aster", "demo.json"),
      JSON.stringify({ demo: "pelagic-v1", created: date }),
    );
    // Windows antivirus/indexers may briefly hold a newly written file open.
    // Retry only sharing failures, checking the destination on every attempt.
    for (let attempt = 0; ; attempt++) {
      try {
        await fs.lstat(root);
        throw new Error(
          "The demo destination appeared during creation; it was preserved.",
        );
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      }
      try {
        await fs.rename(staging, root);
        break;
      } catch (e) {
        if (
          attempt >= 6 ||
          !["EPERM", "EBUSY", "EACCES"].includes(
            (e as NodeJS.ErrnoException).code ?? "",
          )
        )
          throw e;
        await delay(100 * 2 ** attempt);
      }
    }
  } finally {
    if (
      path.dirname(staging) !== parent ||
      !path.basename(staging).startsWith(".pelagic-staging-")
    )
      throw new Error("Invalid staging cleanup path.");
    await fs.rm(staging, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    });
  }
  return root;
}

export async function ensureDemoVault(root: string, assetDirectory: string) {
  try {
    const stat = await fs.lstat(root);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error("The demo location is not an ordinary directory.");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT")
      return createDemoVault(root, assetDirectory);
    throw e;
  }
  const marker = JSON.parse(
    await fs.readFile(path.join(root, ".aster", "demo.json"), "utf8"),
  );
  if (marker.demo !== "pelagic-v1")
    throw new Error(
      "An unrelated folder occupies the demo location. Its contents were preserved.",
    );
  return root;
}
