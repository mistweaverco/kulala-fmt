import json from "@rollup/plugin-json";
import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
const config = [
  {
    input: "src/index.ts",
    output: {
      file: "dist/cli.cjs",
      format: "cjs",
      sourcemap: false,
    },
    external: ["tree-sitter", "@mistweaverco/tree-sitter-kulala", "prettier"],
    plugins: [
      json(),
      commonjs(),
      typescript({
        tsconfig: "./tsconfig.json",
        noForceEmit: true,
      }),
      resolve({
        preferBuiltins: true,
      }),
    ],
  },
];
export default config;
