#!/usr/bin/env node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build } from "./build.mjs";

const USAGE = `usage: cli.mjs <build|validate> [--root DIR] [--dist DIR]

  build     render every live course into --dist (default: <root>/dist)
  validate  run the whole build into a temp directory and report problems;
            nothing is written to <root>/dist`;

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = { command, root: process.cwd(), dist: null };
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i] === "--root") options.root = rest[++i];
    else if (rest[i] === "--dist") options.dist = rest[++i];
    else if (rest[i].startsWith("--root=")) options.root = rest[i].slice(7);
    else if (rest[i].startsWith("--dist=")) options.dist = rest[i].slice(7);
    else return { error: `unknown argument: ${rest[i]}` };
  }
  return options;
}

const options = parseArgs(process.argv.slice(2));

if (options.error || !["build", "validate"].includes(options.command)) {
  console.error(options.error ? `${options.error}\n\n${USAGE}` : USAGE);
  process.exit(2);
}

const rootDir = resolve(options.root);

try {
  if (options.command === "build") {
    const distDir = resolve(options.dist ?? join(rootDir, "dist"));
    const { summaries } = await build({ rootDir, distDir });
    console.log(`built ${summaries.length} courses into ${distDir}`);
    for (const summary of summaries) console.log(`  ${summary.route} (${summary.lessons} lessons)`);
  } else {
    const distDir = await mkdtemp(join(tmpdir(), "learning-validate-"));
    try {
      const { summaries } = await build({ rootDir, distDir });
      console.log(`ok: ${summaries.length} courses, no manifest or link errors`);
      for (const summary of summaries) console.log(`  ${summary.route}`);
    } finally {
      await rm(distDir, { recursive: true, force: true });
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
