#!/usr/bin/env node
/**
 * Cross-platform entry point for the link check.
 *
 * `CHECK_LINKS=true astro build` is POSIX shell syntax and fails in PowerShell,
 * so the flag is set here instead and passed down to the build. Mirrors what
 * `npm run build` does: generate llms.txt first, then build.
 */

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const env = { ...process.env, CHECK_LINKS: "true" };
const rootDir = path.resolve(__dirname, "..");

/** Run a step, exiting with its status code as soon as one fails. */
function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    env,
    stdio: "inherit",
    // Astro ships as a shell script on Windows, which requires a shell to run.
    shell: process.platform === "win32",
  });

  if (result.error) {
    console.error(`Failed to run ${command}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(process.execPath, [path.join(__dirname, "generate-llms.cjs")]);
run("astro", ["build"]);
