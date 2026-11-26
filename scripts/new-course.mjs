#!/usr/bin/env node
// Scaffold a course from templates/course. The copy is the whole registration
// step: discovery finds courses/<slug>/course.json on the next build.
import { cp, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { RESERVED_SLUGS } from "../platform/build/schema.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const templateDir = join(repoRoot, "templates", "course");

const SLUG = /^[a-z0-9][a-z0-9-]{1,40}$/;
const TEXT = /\.(md|json|html|js|mjs|txt|ya?ml)$/;

/** "my-graphs" → "My graphs". The title is a placeholder, not a guess. */
function titleFor(slug) {
  const words = slug.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Next free order: after the highest existing course, in tens. */
async function nextOrder(coursesDir) {
  let highest = 0;
  let names = [];
  try {
    names = await readdir(coursesDir);
  } catch {
    return 10;
  }
  for (const name of names) {
    try {
      const raw = JSON.parse(await readFile(join(coursesDir, name, "course.json"), "utf8"));
      if (typeof raw.order === "number" && raw.order > highest) highest = raw.order;
    } catch {
      // A half-written neighbour is not this script's problem; discovery will
      // report it. Skip it and keep the numbering sane.
    }
  }
  return highest + 10;
}

/** Rewrite the template slug in every text file so no stale reference survives. */
async function rewriteSlug(dir, from, to) {
  for (const name of await readdir(dir)) {
    const path = join(dir, name);
    const info = await stat(path);
    if (info.isDirectory()) {
      await rewriteSlug(path, from, to);
      continue;
    }
    if (!TEXT.test(name)) continue;
    const text = await readFile(path, "utf8");
    if (text.includes(from)) await writeFile(path, text.split(from).join(to));
  }
}

/**
 * @param {string} slug lowercase directory name, also the public URL segment
 * @param {{ rootDir?: string, live?: boolean }} [options]
 * @returns {Promise<string>} the new course directory
 */
export async function newCourse(slug, { rootDir = repoRoot, live = false } = {}) {
  if (!SLUG.test(slug)) {
    throw new Error(`invalid slug "${slug}": expected lowercase letters, digits and dashes (^${SLUG.source}$)`);
  }
  if (RESERVED_SLUGS.has(slug)) {
    throw new Error(`"${slug}" is a reserved slug: the build already owns that path`);
  }

  const coursesDir = join(rootDir, "courses");
  const target = join(coursesDir, slug);
  if (existsSync(target)) {
    throw new Error(`${target} already exists — pick another slug or delete it first`);
  }

  // Before the copy: once it exists, its own template order (900) is a neighbour.
  const order = await nextOrder(coursesDir);

  await cp(templateDir, target, { recursive: true });
  await rewriteSlug(target, "example-course", slug);

  const manifestPath = join(target, "course.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.slug = slug;
  manifest.title = titleFor(slug);
  manifest.order = order;
  manifest.status = live ? "live" : "draft";
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  return target;
}

export function parseArgs(argv) {
  const args = argv.slice(2);
  const options = { slug: undefined, root: repoRoot, live: false };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--live") {
      options.live = true;
    } else if (arg === "--root") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error("--root needs a directory");
      options.root = value;
      index += 1;
    } else if (arg.startsWith("--")) {
      throw new Error(`unknown option ${arg}`);
    } else if (options.slug === undefined) {
      options.slug = arg;
    } else {
      throw new Error(`unexpected argument ${arg}`);
    }
  }

  return options;
}

function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
    return;
  }

  if (!options.slug) {
    process.stderr.write("usage: npm run new -- <slug> [--live] [--root <repo>]\n");
    process.exitCode = 1;
    return;
  }

  const { slug, root, live } = options;

  newCourse(slug, { rootDir: root, live })
    .then((dir) => {
      process.stdout.write(
        [
          `created ${dir}`,
          "",
          `  status: ${live ? "live" : "draft"} (flip it in course.json when it is worth reading)`,
          "  next:   edit course.json and lessons/01-intro.md, then `npm run dev`",
          "",
        ].join("\n"),
      );
    })
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv);
}
