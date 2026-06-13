import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tryInstallBackend } from "./lib/downloader";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// Published packages only ship dist/; skip when installing from a source checkout.
if (existsSync(join(packageRoot, "scripts", "build.mjs"))) {
  process.exit(0);
}

tryInstallBackend().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Warning: kulala-core postinstall failed: ${message}`);
  console.error("kulala-fmt will attempt to download it on first use instead.");
});
