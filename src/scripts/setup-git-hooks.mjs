import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const hooksPath = ".githooks";
const absoluteHooksPath = path.join(repoRoot, hooksPath);

if (!existsSync(absoluteHooksPath)) {
  process.exit(0);
}

try {
  execFileSync("git", ["rev-parse", "--git-dir"], {
    cwd: repoRoot,
    stdio: "ignore",
  });
} catch {
  process.exit(0);
}

let currentHooksPath = "";

try {
  currentHooksPath = execFileSync("git", ["config", "--local", "--get", "core.hooksPath"], {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
} catch {
  currentHooksPath = "";
}

if (!currentHooksPath) {
  execFileSync("git", ["config", "--local", "core.hooksPath", hooksPath], {
    cwd: repoRoot,
    stdio: "ignore",
  });
  console.log(`Configured git hooks path: ${hooksPath}`);
  process.exit(0);
}

if (currentHooksPath !== hooksPath) {
  console.log(
    `Skipped git hook setup because core.hooksPath is already set to ${currentHooksPath}`
  );
}
