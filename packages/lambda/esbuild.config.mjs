import { build } from "esbuild";

await build({
  entryPoints: ["src/handler.ts"],
  outfile: "dist/handler.js",
  platform: "node",
  target: "node20",
  bundle: true,
  minify: false,
  sourcemap: true,
  format: "cjs",
});

console.log("Build complete: dist/handler.js");
