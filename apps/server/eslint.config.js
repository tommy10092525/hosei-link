import { config } from "@repo/eslint-config/base";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...config,
  // wrangler types の生成物
  { ignores: ["worker-configuration.d.ts"] },
];
