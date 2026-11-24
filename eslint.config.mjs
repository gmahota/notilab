/**
 * eslint.config.mjs
 *
 * Flat config, replacing the former `.eslintrc.json`.
 *
 * Why: `next lint` is deprecated and is removed in Next 16, and
 * eslint-config-next 16 ships flat config only -- loading it through the old
 * eslintrc file fails with "Converting circular structure to JSON". Linting
 * now runs through the ESLint CLI (`eslint .`), see package.json.
 *
 * Coverage note: `next lint` only ever looked at app/, components/ and lib/.
 * `eslint .` walks the whole repository, which adds __tests__/, scripts/,
 * prisma/seed.ts and the root config files. The ignore list below is what keeps
 * that widening honest -- it excludes build output, generated code and nested
 * worktrees, and no first-party source.
 */

import nextCoreWebVitals from "eslint-config-next/core-web-vitals"
import nextTypeScript from "eslint-config-next/typescript"

const eslintConfig = [
  // Global ignores. `.next/`, `out/`, `build/` and `next-env.d.ts` already come
  // from eslint-config-next, and node_modules is an ESLint default; the rest is
  // what `next lint`'s directory scoping used to hide.
  {
    ignores: [
      ".next/**",
      ".swc/**",
      ".vercel/**",
      "coverage/**",
      "next-env.d.ts",
      // Prisma 7 generates its client into lib/generated/prisma/ at install
      // time (gitignored). The committed barrel lib/generated/prisma.ts is
      // hand-written and stays linted -- do not widen this to lib/generated/**.
      "lib/generated/prisma/**",
      // Nested git worktrees: full copies of this repo that must not be linted
      // a second time (they also upset jest-haste-map).
      ".claude/worktrees/**",
    ],
  },

  // Everything `next lint` gave us via
  // `extends: ["next/core-web-vitals", "next/typescript"]`, in flat form.
  ...nextCoreWebVitals,
  ...nextTypeScript,

  // Repo rules, carried over verbatim from .eslintrc.json.
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },

  // ---------------------------------------------------------------------
  // Rules that are NEW in eslint-config-next 16 and were never enforced
  // before this migration. They are demoted to "warn" so that this PR stays a
  // pure config migration: the set of rules that can fail CI is exactly the
  // set that could fail it under `next lint` + eslint-config-next 15.
  //
  // They are deliberately left visible rather than turned off. Promoting them
  // back to "error" means fixing ~13 real findings (9 components use
  // setState-in-effect, 2 use impure render logic), which is frontend work with
  // actual behavioural risk and belongs in its own reviewed change -- not in a
  // lint-plumbing PR.
  //
  // eslint-plugin-react-hooks v6 ships the React Compiler rule set; the Next
  // rule below is also new in 16.
  // ---------------------------------------------------------------------
  {
    rules: {
      "@next/next/no-location-assign-relative-destination": "warn",
      "react-hooks/config": "warn",
      "react-hooks/error-boundaries": "warn",
      "react-hooks/gating": "warn",
      "react-hooks/globals": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/set-state-in-render": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/use-memo": "warn",
    },
  },
]

export default eslintConfig
