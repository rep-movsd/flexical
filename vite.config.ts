import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { cloudflare } from "@cloudflare/vite-plugin";

// The Cloudflare plugin runs the Worker in workerd during `vite dev`, serves the
// client from Vite, and — on `vite build` — emits both the client assets and the
// Worker into `dist/`, wiring up `assets.directory` in a generated wrangler config.
export default defineConfig({
  plugins: [preact(), cloudflare()],
});
