import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");

  return {
    // Allow workflow to set Pages subpath (e.g. /repo-name/).
    base: env.VITE_BASE_PATH || "/",
  };
});
