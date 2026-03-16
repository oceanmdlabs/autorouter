import { execFileSync, spawnSync } from "node:child_process";

const ZERO_SHA = "0000000000000000000000000000000000000000";
const RELEVANT_FILE_PATTERN = /\.(ts|vue)$/i;

function readHookInput() {
  let input = "";
  process.stdin.setEncoding("utf8");

  return new Promise((resolve) => {
    process.stdin.on("data", (chunk) => {
      input += chunk;
    });
    process.stdin.on("end", () => resolve(input));
    process.stdin.resume();
  });
}

function getChangedFilesForUpdate(localSha, remoteSha) {
  if (remoteSha === ZERO_SHA) {
    return null;
  }

  const output = execFileSync(
    "git",
    ["diff", "--name-only", `${remoteSha}..${localSha}`],
    {
      encoding: "utf8",
    }
  );

  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function shouldRunTypecheck(updateLines) {
  if (updateLines.length === 0) {
    return false;
  }

  for (const line of updateLines) {
    const [localRef, localSha, remoteRef, remoteSha] = line.split(/\s+/);
    if (!localRef || !localSha || !remoteRef || !remoteSha) {
      continue;
    }

    if (localSha === ZERO_SHA) {
      continue;
    }

    if (remoteSha === ZERO_SHA) {
      return true;
    }

    const changedFiles = getChangedFilesForUpdate(localSha, remoteSha);
    if (changedFiles?.some((file) => RELEVANT_FILE_PATTERN.test(file))) {
      return true;
    }
  }

  return false;
}

const rawInput = await readHookInput();
const updateLines = rawInput
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);

if (!shouldRunTypecheck(updateLines)) {
  console.log("pre-push: skipping typecheck (no .ts or .vue changes in push)");
  process.exit(0);
}

console.log("pre-push: running typecheck");
const result = spawnSync("npm", ["run", "typecheck"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
