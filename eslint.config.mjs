import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import * as eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";

export default [
  { files: ["**/*.{js,mjs,cjs,ts}"] },
  { files: ["**/*.js"], languageOptions: { sourceType: "commonjs" } },
  { languageOptions: { globals: globals.browser } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  eslintPluginPrettierRecommended.default,
  {
    ignores: ["dist/**/*", "node_modules/**/*"],
  },
];
