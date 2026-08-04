// vite.config.ts — configuración para Vercel (TanStack Start + Nitro)
// Nitro detecta automáticamente el entorno de Vercel durante el build.
// NO agregar @cloudflare/vite-plugin ni @lovable.dev/vite-tanstack-config.
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [
    // tanstackStart DEBE ir primero
    tanstackStart(),
    nitro(),
    viteReact(),
    tailwindcss(),
    tsConfigPaths(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
