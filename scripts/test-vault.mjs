import fs from "node:fs/promises";
import path from "node:path";
import { SAMPLE_NOTES } from "../packages/core/sample.ts";

// Stable, small fixture for regression suites. Production startup uses Pelagic Labs.
export async function createBasicVault(profile) {
  const root = path.join(profile, "Regression vault");
  for (const [name, content] of Object.entries(SAMPLE_NOTES)) {
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await fs.writeFile(path.join(root, name), content, { flag: "wx" });
  }
  return root;
}
