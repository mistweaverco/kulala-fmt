import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
const config = [
  {
    input: "src/index.ts",
    output: {
      file: "dist/cli.cjs",
      format: "cjs",
      sourcemap: true,
    },
    plugins: [
      typescript({
        tsconfig: "./tsconfig.json",
        noForceEmit: true,
      }),
      resolve(),
      commonjs(),
    ],
  },
];
export default config;
