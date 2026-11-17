// Next.js configuration of apps/web (card P0-02.5). A .mjs file: nothing transpiles the configuration at start.
// No `output` setting: the image's `web` entrypoint is still the stub (docs/ops/local-dev.md, "Application image").

/** @type {import("next").NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // @bridle/i18n, @bridle/model and @bridle/solver are TypeScript source (their `exports` name src/*.ts): Next
  // compiles them with the application, the solver's worker entry included (card PX-02.8).
  transpilePackages: ["@bridle/i18n", "@bridle/model", "@bridle/solver"],
  // No development badge: it would be in the smoke test's screenshot.
  devIndicators: false,
  // There is no ESLint in this workspace: Biome is the lint (`pnpm lint`, the first step of `pnpm check`).
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
