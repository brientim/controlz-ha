/** Bundle src/ into dist/controlz-ha.js, stamping the package.json version. `--watch` rebuilds on change. */
import { build, context } from "esbuild";
import { readFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

const options = {
  entryPoints: ["src/index.js"],
  bundle: true,
  format: "esm",
  target: "es2021",
  minify: process.argv.includes("--minify"),
  outfile: "dist/controlz-ha.js",
  define: { __CONTROLZ_HA_VERSION__: JSON.stringify(version) },
  banner: { js: `/*! ControlZ HA ${version} — MIT — https://github.com/brientim/controlz-ha */` },
  logLevel: "info",
};

if (process.argv.includes("--watch")) {
  await (await context(options)).watch();
} else {
  await build(options);
}
