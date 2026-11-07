import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectRegister: "auto",
      manifest: {
        name: "FiMs Dashboard",
        short_name: "FiMs",
        description: "FiMs DeFi dashboard — Jupiter, Kamino, Multiply and prices",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0b0f17",
        theme_color: "#0b0f17",
        icons: [
          ...[48, 72, 96, 128, 144, 192, 384, 512].map(s => ({
            src: `/icons/icon-${s}.png`,
            sizes: `${s}x${s}`,
            type: "image/png",
            purpose: "any",
          })),
          { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
      },
    }),
  ],
});
