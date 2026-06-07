import { applyD1Migrations, env } from "cloudflare:test";

// Runs once before the test suite: applies all D1 migrations to the test DB.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
