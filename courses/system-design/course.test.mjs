import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "../../platform/build/build.mjs";

const repoRoot = new URL("../../", import.meta.url).pathname;
const appRoot = join(repoRoot, "courses/system-design/app");

const isFile = async (path) => {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
};

test("system design build output lands under the course app path with relative asset URLs", async (t) => {
  const distDir = await mkdtemp(join(tmpdir(), "learning-sd-"));
  try {
    // The vite sub-build installs and compiles a React app; give it room.
    t.diagnostic("running npm ci && npm run build in courses/system-design/app");
    await build({ rootDir: repoRoot, distDir });

    const html = await readFile(join(distDir, "courses/system-design/app/index.html"), "utf8");
    assert.ok(html.includes('src="./assets/'), "asset URLs must stay relative to the mount");
    assert.ok(html.includes("<title>System Design"), "the app's own title survived");
    assert.equal(html.split("<!--learning-pill-->").length - 1, 1);
    assert.ok(html.includes('href="/"'), "pill links back to the platform home");

    const assets = html.match(/src="\.\/assets\/([^"]+)"/)?.[1];
    assert.ok(assets && (await isFile(join(distDir, "courses/system-design/app/assets", assets))), "hashed entry asset");

    // Only the build output is mounted: no sources, no dependencies.
    assert.ok(!existsSync(join(distDir, "courses/system-design/app/src/main.tsx")));
    assert.ok(!existsSync(join(distDir, "courses/system-design/app/node_modules")));
    assert.ok(!existsSync(join(distDir, "courses/system-design/app/package.json")));

    // The landing page points at the mounted entry.
    const landing = await readFile(join(distDir, "courses/system-design/index.html"), "utf8");
    assert.ok(landing.includes('href="/courses/system-design/app/index.html"'));

    // The build manifest knows the app ships (so the smoke test visits it).
    const manifest = JSON.parse(await readFile(join(distDir, "build.json"), "utf8"));
    const entry = manifest.courses.find((course) => course.slug === "system-design").entry;
    assert.equal(entry, "/courses/system-design/app/index.html");
  } finally {
    await rm(distDir, { recursive: true, force: true });
  }
});
