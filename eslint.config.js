// eslint.config.js - minimal ESLint v9 configuration for TypeScript project
// This file satisfies the new default ESLint config file name required by ESLint 9.
// It extends the recommended TypeScript and Node rules and enables linting of .ts and .tsx files.

import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  // Base JavaScript recommended rules
  { files: ["**/*.js", "**/*.cjs", "**/*.mjs"], languageOptions: { sourceType: "module", globals: globals.node }, ...pluginJs.configs.recommended },
  // TypeScript specific rules
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: { parser: tseslint.parser, sourceType: "module", globals: globals.node },
    plugins: { "@typescript-eslint": tseslint },
    ...tseslint.configs.recommended,
    rules: {
      // You can customize rules here. Example: allow unused vars starting with underscore.
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }]
    }
  }
];
