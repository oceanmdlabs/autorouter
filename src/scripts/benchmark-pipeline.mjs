#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { performance } from "node:perf_hooks";

const rootDir = process.cwd();

const DEFAULT_RUNS = 1;
const VALID_GROUPS = new Set(["typecheck", "build", "all"]);

function parseArgs(argv) {
  let group = "all";
  let runs = DEFAULT_RUNS;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--group") {
      group = argv[i + 1] ?? group;
      i += 1;
      continue;
    }

    if (arg === "--runs") {
      const rawRuns = Number.parseInt(argv[i + 1] ?? "", 10);
      if (!Number.isNaN(rawRuns) && rawRuns > 0) {
        runs = rawRuns;
      }
      i += 1;
    }
  }

  if (!VALID_GROUPS.has(group)) {
    throw new Error(`Unsupported group '${group}'. Expected one of: ${[...VALID_GROUPS].join(", ")}`);
  }

  return { group, runs };
}

function commandGroups() {
  return {
    typecheck: [
      {
        name: "tsc --noEmit",
        command: "npx",
        args: ["tsc", "-p", "tsconfig.json", "--noEmit"],
      },
      {
        name: "vue-tsc --noEmit",
        command: "npx",
        args: ["vue-tsc", "-p", "tsconfig.json", "--noEmit"],
      },
      {
        name: "nuxi typecheck",
        command: "npm",
        args: ["run", "typecheck"],
      },
      {
        name: "tsgo --noEmit",
        command: "npm",
        args: [
          "exec",
          "--package",
          "@typescript/native-preview",
          "--",
          "tsgo",
          "-p",
          "tsconfig.json",
          "--noEmit",
        ],
      },
    ],
    build: [
      {
        name: "nuxt build",
        command: "npm",
        args: ["run", "build"],
      },
      {
        name: "nuxt build (aws_lambda)",
        command: "npm",
        args: ["run", "build:aws"],
      },
      {
        name: "cdk synth --no-lookups",
        command: "npm",
        args: ["run", "cdk:synth", "--", "--no-lookups"],
        cwd: "infrastructure/cdk",
        env: {
          APP_ENV: "{}",
          APP_SECRET_ENV: "{}",
        },
      },
    ],
  };
}

function resolveCommands(group) {
  const groups = commandGroups();
  if (group === "all") {
    return [...groups.typecheck, ...groups.build];
  }

  return groups[group];
}

function runCommand(definition) {
  const startedAt = performance.now();
  const result = spawnSync(definition.command, definition.args, {
    cwd: definition.cwd ? path.resolve(rootDir, definition.cwd) : rootDir,
    env: {
      ...process.env,
      ...(definition.env ?? {}),
    },
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  const elapsedMs = performance.now() - startedAt;

  if (result.status !== 0) {
    const rendered = [definition.command, ...definition.args].join(" ");
    throw new Error(`Benchmark command failed (${rendered}) with exit code ${result.status ?? "unknown"}`);
  }

  return elapsedMs;
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatSeconds(milliseconds) {
  return `${(milliseconds / 1000).toFixed(2)}s`;
}

function printResults(results, runs) {
  console.log("");
  console.log("| Command | Runs | Mean | Samples |");
  console.log("| --- | ---: | ---: | --- |");

  for (const result of results) {
    const samples = result.samples.map((value) => formatSeconds(value)).join(", ");
    console.log(
      `| ${result.name} | ${runs} | ${formatSeconds(mean(result.samples))} | ${samples} |`
    );
  }
}

try {
  const { group, runs } = parseArgs(process.argv.slice(2));
  const commands = resolveCommands(group);
  const results = [];

  console.log(`Benchmark group: ${group}`);
  console.log(`Runs per command: ${runs}`);

  for (const definition of commands) {
    const samples = [];
    for (let runNumber = 1; runNumber <= runs; runNumber += 1) {
      console.log("");
      console.log(`[${runNumber}/${runs}] ${definition.name}`);
      samples.push(runCommand(definition));
    }
    results.push({
      name: definition.name,
      samples,
    });
  }

  printResults(results, runs);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
