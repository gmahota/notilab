import nextJest from "next/jest.js"

/**
 * next/jest wires up the SWC transform (so TypeScript needs no separate
 * compiler step), resolves the `@/*` paths from tsconfig, and loads the .env
 * files the way `next build` does.
 *
 * That last part matters for anything reading process.env: a test must not
 * assume a variable is unset just because it is absent from CI. Tests that care
 * about an env var should delete it explicitly — see __tests__/lib/base-url.test.ts.
 */
const createJestConfig = nextJest({ dir: "./" })

/** @type {import('jest').Config} */
const config = {
  // Every current test covers a lib/ module with no DOM involved. Switch a
  // component test to jsdom per-file with a `@jest-environment` docblock.
  testEnvironment: "node",
  testMatch: ["<rootDir>/__tests__/**/*.test.ts", "<rootDir>/__tests__/**/*.test.tsx"],
  // Mapped by hand on purpose: next/jest derives the `@/*` alias from
  // tsconfig's `baseUrl`, and this tsconfig sets `paths` without one (valid
  // under moduleResolution: bundler), so the alias would not resolve here.
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  clearMocks: true,
  restoreMocks: true,
}

export default createJestConfig(config)
