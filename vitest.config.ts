import {
  defineWorkersConfig,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));

export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations(path.join(dir, "migrations"));
  return {
    test: {
      setupFiles: ["./tests/apply-migrations.ts"],
      poolOptions: {
        workers: {
          singleWorker: true,
          isolatedStorage: true,
          miniflare: {
            // Provide migrations to the setup file via a test-only binding.
            bindings: { TEST_MIGRATIONS: migrations },
          },
          wrangler: { configPath: "./wrangler.jsonc" },
        },
      },
    },
  };
});
