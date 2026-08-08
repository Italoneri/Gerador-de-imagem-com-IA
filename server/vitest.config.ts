import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      BFL_API_KEY: "chave-de-teste",
      // 3 tentativas de polling (4500 / 1500), o suficiente para cobrir o
      // caminho "Pending → Ready" e o estouro sem deixar a suíte lenta.
      REQUEST_TIMEOUT_MS: "4500",
    },
  },
});
