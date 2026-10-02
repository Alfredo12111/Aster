import { build } from "esbuild";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { scanText } from "./audit-publish.mjs";

await fs.mkdir(".tools", { recursive: true });
await fs.mkdir("artifacts", { recursive: true });
const runtime = path.resolve(".tools/demo-runtime.cjs");
await build({
  entryPoints: ["packages/demo/filesystem.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile: runtime,
});
const { createDemoVault } = createRequire(import.meta.url)(runtime);
const staging = await fs.mkdtemp(path.resolve(".tools/demo-export-"));
try {
  const root = path.join(staging, "Pelagic Labs");
  // App copies use the current local date; the downloadable edition has a stable timeline.
  await createDemoVault(root, path.resolve("public/demo"), "2026-10-02");
  let files = 0;
  async function audit(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await audit(file);
        continue;
      }
      const relative = path.relative(root, file).replaceAll("\\", "/");
      if (
        !/^(?:[^.].*\.md|Attachments\/[a-z-]+\.pdf|\.aster\/(?:vault|modules|demo)\.json)$/.test(
          relative,
        )
      )
        throw new Error("Unexpected demo file: " + relative);
      const bytes = await fs.readFile(file);
      if (!bytes.includes(0) && scanText(bytes.toString("utf8")).length)
        throw new Error("Demo publication audit failed: " + relative);
      files++;
    }
  }
  await audit(root);
  const archive = path.resolve("artifacts/Pelagic-Labs-demo.zip"),
    quote = (s) => "'" + s.replaceAll("'", "''") + "'";
  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `Compress-Archive -LiteralPath ${quote(root)} -DestinationPath ${quote(archive)} -CompressionLevel Optimal -Force`,
    ],
    { stdio: "inherit" },
  );
  const digest = createHash("sha256")
    .update(await fs.readFile(archive))
    .digest("hex");
  let sums = await fs
    .readFile("artifacts/SHA256SUMS.txt", "utf8")
    .catch(() => "");
  sums = sums
    .split("\n")
    .filter((s) => s && !s.endsWith("  Pelagic-Labs-demo.zip"))
    .join("\n");
  await fs.writeFile(
    "artifacts/SHA256SUMS.txt",
    (sums ? sums + "\n" : "") + digest + "  Pelagic-Labs-demo.zip\n",
  );
  console.log(
    `Exported and audited ${files} synthetic vault files in Pelagic-Labs-demo.zip.`,
  );
} finally {
  if (
    path.dirname(staging) !== path.resolve(".tools") ||
    !path.basename(staging).startsWith("demo-export-")
  )
    throw new Error("Invalid demo staging path");
  await fs.rm(staging, { recursive: true, force: true });
}
