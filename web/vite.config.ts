import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const SERVER_PORT = process.env.PORT ?? "8787";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Em dev o front chama /api/* na mesma origem e o Vite repassa para o
    // Express — assim não existe CORS e a chave nunca sai do servidor.
    proxy: {
      "/api": { target: `http://localhost:${SERVER_PORT}`, changeOrigin: true },
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
