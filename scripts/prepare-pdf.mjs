import fs from "node:fs/promises";
import path from "node:path";
// Bundle PDF rendering resources locally; reading a PDF must not need a CDN.
const source = path.resolve("node_modules/pdfjs-dist");
const target = path.resolve("public/pdfjs");
await fs.mkdir(target, { recursive: true });
for (const folder of ["cmaps", "standard_fonts", "wasm"]) {
  await fs.cp(path.join(source, folder), path.join(target, folder), {
    recursive: true,
  });
}
await fs.copyFile(path.join(source, "LICENSE"), path.join(target, "LICENSE"));
