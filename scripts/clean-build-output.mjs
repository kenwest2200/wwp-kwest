import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
for (const name of ["dist", ".astro"]) {
  const dir = path.join(root, name);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    process.stdout.write(`removed ${name}/\n`);
  }
}
