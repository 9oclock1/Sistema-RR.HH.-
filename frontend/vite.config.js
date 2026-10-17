import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: [".62344037.xyz"],
    watch: {
      usePolling: true,
    },
    hmr: {
      clientPort: 80,
    },
  },
});
