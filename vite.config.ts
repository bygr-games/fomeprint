import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");

  return {
    // Allow workflow to set Pages subpath (e.g. /repo-name/).
    base: env.VITE_BASE_PATH || "/",
    optimizeDeps: {
      // Prevent Vite from prebundling the linked local package into
      // node_modules/.vite/deps, which can otherwise serve stale code.
      exclude: ["fra.ktu.red-component"],
    },
  };
});
