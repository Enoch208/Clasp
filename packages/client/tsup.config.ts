import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  target: "es2022",
  noExternal: [/^@clasp\//],
  dts: {
    compilerOptions: {
      rootDir: "../..",
      baseUrl: ".",
      paths: {
        "@clasp/protocol": ["../protocol/src/index.ts"],
        "@clasp/token": ["../token/src/index.ts"],
      },
    },
  },
  clean: true,
});
