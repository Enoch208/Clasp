import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  target: "es2022",
  external: ["react", "@useclasp/client"],
  banner: { js: '"use client";' },
  dts: true,
  clean: true,
});
