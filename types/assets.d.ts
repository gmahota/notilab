// TypeScript 6 reports TS2882 for a side-effect import that resolves to no
// module or type declaration. Next.js handles stylesheets at build time, so
// the only thing missing is the declaration itself.
declare module "*.css"
