// Reads the encrypted .env and writes it as a TS module so it gets bundled into the worker.
const content = await Bun.file(".env").text();
const escaped = JSON.stringify(content);
const out = `// Auto-generated — do not edit. Run: bun scripts/bundle-env.ts\nexport const ENCRYPTED_ENV = ${escaped};\n`;

// This file lives under wrangler's build `watch_dir` ("src"). Writing it
// unconditionally bumps the mtime, which retriggers the watch → rebuild →
// rewrite → infinite build loop in `wrangler dev`. Only write when the
// content actually changed so the watcher settles after the first run.
const target = "src/server/env.generated.ts";
const existing = await Bun.file(target).text().catch(() => null);
if (existing === out) {
    console.log("[bundle-env] src/server/env.generated.ts up to date — skipping write");
} else {
    await Bun.write(target, out);
    console.log("[bundle-env] Generated src/server/env.generated.ts");
}
