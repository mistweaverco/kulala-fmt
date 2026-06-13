import { build } from "vite-plus";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { builtinModules } from "node:module";

if (process.env.npm_lifecycle_event === "install") {
  console.log("Skipping build during pnpm install");
  process.exit(0);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const nodeBuiltins = new Set([
  ...builtinModules,
  ...builtinModules.map((moduleName) => `node:${moduleName}`),
]);

function isNodeBuiltin(id) {
  return nodeBuiltins.has(id) || id.startsWith("node:");
}

function nodeBundle(entry, outFile, emptyOutDir) {
  return {
    build: {
      ssr: resolve(root, entry),
      outDir: resolve(root, "dist"),
      emptyOutDir,
      minify: false,
      target: "node20",
      rollupOptions: {
        external: (id) => isNodeBuiltin(id),
        output: {
          entryFileNames: outFile,
          format: "cjs",
          codeSplitting: false,
        },
      },
    },
    ssr: {
      noExternal: true,
    },
  };
}

await build(nodeBundle("src/index.ts", "cli.cjs", true));
await build(nodeBundle("src/postinstall.ts", "install-backend.cjs", false));
