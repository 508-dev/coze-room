import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [svelte()],
  server: {
    // Bind the same IPv4 loopback the port helper and .env.example advertise.
    // Vite's default resolves "localhost" to [::1] on some Linux setups, which
    // leaves the dev server unreachable at the 127.0.0.1 address every other
    // part of the stack prints.
    host: process.env.WEB_HOST ?? "127.0.0.1",
    port: Number(process.env.WEB_PORT ?? 8830),
    strictPort: true,
  },
  build: {
    target: "es2022",
    outDir: "dist",
  },
});
