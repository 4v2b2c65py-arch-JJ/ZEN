import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "ws://localhost:3333",
        changeOrigin: true,
        ws: true,
      },
      "/proxy": {
        target: "ws://localhost:3334",
        changeOrigin: true,
        ws: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
