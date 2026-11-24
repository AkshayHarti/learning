#!/usr/bin/env node
/**
 * One-way import of the 8-week python course from llm-first-principles.
 *
 * Copies the runnable lab environment (weeks/, mygpt/, tests/, pyproject.toml,
 * Makefile) and turns SYLLABUS.md, INSTRUCTOR.md, CAPSTONE.md and each
 * weeks/w0N_<slug>/README.md into lessons/<id>.md with frontmatter the platform
 * understands. Bodies are copied verbatim — this script may not rewrite prose.
 *
 * Idempotent: running it twice produces the same files. Only the generated
 * destinations are touched, never the source.
 *
 * usage: node scripts/import-python-course.mjs [--from DIR]
 */
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const DEFAULT_SOURCE = join(homedir(), "workspace/repos/llm-first-principles");
const COURSE_DIR = new URL("../courses/python-decoder/", import.meta.url).pathname;

/** Environment directories and files the labs need to run. */
const ENVIRONMENT = ["weeks", "mygpt", "tests", "pyproject.toml", "Makefile"];

/** Files that must never travel: they are machine-specific or derived. */
const EXCLUDED = /(^|\/)(__pycache__|\.pytest_cache|\.mypy_cache|\.venv|\.DS_Store)(\/|$)|\.pyc$/;

/** Lesson id → source markdown, in the order the course reads. */
const LESSONS = [
  { id: "syllabus", from: "SYLLABUS.md" },
  { id: "w01", from: "weeks/w01_prediction/README.md", lab: "weeks/w01_prediction" },
  { id: "w02", from: "weeks/w02_tokens/README.md", lab: "weeks/w02_tokens" },
  { id: "w03", from: "weeks/w03_attention/README.md", lab: "weeks/w03_attention" },
  { id: "w04", from: "weeks/w04_transformer/README.md", lab: "weeks/w04_transformer" },
  { id: "w05", from: "weeks/w05_decoding/README.md", lab: "weeks/w05_decoding" },
  { id: "w06", from: "weeks/w06_posttraining/README.md", lab: "weeks/w06_posttraining" },
  { id: "w07", from: "weeks/w07_serving/README.md", lab: "weeks/w07_serving" },
  { id: "w08", from: "weeks/w08_evals/README.md", lab: "weeks/w08_evals" },
  { id: "instructor", from: "INSTRUCTOR.md" },
  { id: "capstone", from: "CAPSTONE.md" },
];

function parseArgs(argv) {
  const options = { from: DEFAULT_SOURCE };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--from") options.from = argv[i + 1];
    else if (argv[i].startsWith("--from=")) options.from = argv[i].slice(7);
    else throw new Error(`unknown argument: ${argv[i]}`);
  }
  return options;
}

/** First `# heading` in a markdown document. */
function firstHeading(markdown) {
  return /^#[ \t]+(.+)$/m.exec(markdown)?.[1]?.trim() ?? null;
}

/**
 * `**Time:** 5h ·` → 300, `**Time:** 6–8 hours ·` → 480.
 * Takes the largest number in the time phrase, so a range reports its ceiling.
 * @returns {number|null} minutes
 */
function minutesFrom(markdown) {
  const line = /^\*\*Time:\*\*(.+)$/m.exec(markdown)?.[1] ?? "";
  const numbers = [...line.matchAll(/(\d+(?:\.\d+)?)/g)].map((match) => Number(match[1]));
  if (numbers.length === 0) return null;
  const largest = Math.max(...numbers);
  return Math.round(largest * (/(?:hours?|h)\b/i.test(line) ? 60 : 1));
}

function frontmatter(fields) {
  const lines = Object.entries(fields)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => `${key}: ${value}`);
  return `---\n${lines.join("\n")}\n---\n`;
}

/** Strip the source's frontmatter if it ever grows one, so we do not nest fences. */
function bodyOf(markdown) {
  return String(markdown).replace(/^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n)?/, "");
}

async function copyEnvironment(sourceDir, destinationDir) {
  let copied = 0;

  async function copyDir(from, to) {
    await mkdir(to, { recursive: true });
    for (const entry of await readdir(from, { withFileTypes: true })) {
      const sourcePath = join(from, entry.name);
      const targetPath = join(to, entry.name);
      if (EXCLUDED.test(sourcePath)) continue;
      if (entry.isDirectory()) await copyDir(sourcePath, targetPath);
      else if (entry.isFile()) {
        await cp(sourcePath, targetPath);
        copied += 1;
      }
    }
  }

  for (const item of ENVIRONMENT) {
    const from = join(sourceDir, item);
    const to = join(destinationDir, item);
    const info = await readdir(from, { withFileTypes: true }).catch(() => null);

    if (info) {
      if (item === "weeks" || item === "mygpt" || item === "tests") {
        // Rebuild, so a deleted lab file cannot linger from an earlier import.
        await rm(to, { recursive: true, force: true });
        await copyDir(from, to);
      } else {
        await cp(from, to);
        copied += 1;
      }
    } else {
      await cp(from, to);
      copied += 1;
    }
  }

  return copied;
}

const options = parseArgs(process.argv.slice(2));
const sourceDir = resolve(options.from);

try {
  await readdir(sourceDir);
} catch {
  console.error(`no such source: ${sourceDir}\npass --from <llm-first-principles checkout>`);
  process.exit(1);
}

const copied = await copyEnvironment(sourceDir, COURSE_DIR);

/**
 * The lab Makefile opens `explorables/index.html`, which is not part of this
 * course any more: the five deep-dive pages moved to the sibling decoder
 * course. Point the target at where they actually live so `make play` works.
 */
async function pointPlayAtDecoderCourse() {
  const path = join(COURSE_DIR, "Makefile");
  const source = await readFile(path, "utf8");
  const adapted = source.replace(
    /^play:.*\n\topen explorables\/index\.html$/m,
    "play:             ## open the explorables in the sibling decoder course (works offline, file://)\n\topen ../decoder-course/app/course.html",
  );
  if (adapted !== source) await writeFile(path, adapted);
  return adapted !== source;
}

await pointPlayAtDecoderCourse();

const lessonsDir = join(COURSE_DIR, "lessons");
await mkdir(lessonsDir, { recursive: true });

for (const lesson of LESSONS) {
  const source = await readFile(join(sourceDir, lesson.from), "utf8");
  const body = bodyOf(source);
  const isWeek = Boolean(lesson.lab);

  const fields = {
    title: firstHeading(source) ?? lesson.id,
    minutes: minutesFrom(source),
    lab: isWeek ? `${lesson.lab}/lab.py` : null,
    solution: isWeek ? `${lesson.lab}/solutions/lab.py` : null,
    run: isWeek ? `uv run pytest ${lesson.lab}` : null,
  };

  await writeFile(join(lessonsDir, `${lesson.id}.md`), frontmatter(fields) + body);
}

console.log(`copied ${copied} files from ${sourceDir}`);
console.log(`wrote ${LESSONS.length} lessons into courses/python-decoder/lessons`);
