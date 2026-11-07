import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Pruebas de interfaz: jsdom simula el navegador; las llamadas a la API se simulan en cada prueba.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/pruebas/preparar.js"],
    css: false,
    clearMocks: true,
  },
});
