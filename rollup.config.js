import typescript from "@rollup/plugin-typescript";
const config = [
  {
    input: "src/cli.ts",
    output: {
      file: "dist/cli.js",
      format: "cjs",
      sourcemap: true,
    },
    plugins: [
      typescript({
        tsconfig: "./tsconfig.json",
        noForceEmit: true,
      }),
    ],
  },
];
export default config;
