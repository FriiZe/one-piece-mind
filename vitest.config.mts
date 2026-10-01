import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Garde-fou de Next.js contre l'import de code serveur dans le navigateur : sans objet dans les tests
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/empty.ts"),
      "@data": path.resolve(import.meta.dirname, "data"),
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
