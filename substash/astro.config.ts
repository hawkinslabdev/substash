import { defineConfig, envField } from "astro/config";
import solidJs from "@astrojs/solid-js";
import node from "@astrojs/node";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  output: "server",
  adapter: node({ mode: "middleware" }),
  prefetch: { defaultStrategy: "hover" },
  integrations: [solidJs()],
  vite: {
    plugins: [tailwindcss()],
    ssr: {
      external: ["better-sqlite3"],
    },
  },
  server: {
    port: 9456,
  },
  env: {
    schema: {
      // Server-only: never exposed to client bundle
      STASH_URL: envField.string({ context: "server", access: "secret" }),
      STASH_API_KEY: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      DB_PATH: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      // Public: safe to expose, needed for CORS + cookie config
      PUBLIC_APP_URL: envField.string({
        context: "client",
        access: "public",
        optional: true,
      }),
      PUBLIC_APP_ORIGINS: envField.string({
        context: "client",
        access: "public",
        optional: true,
      }),
      PUBLIC_AUTH_COOKIE_SECURE: envField.boolean({
        context: "client",
        access: "public",
        optional: true,
      }),
      STASH_TAGS_EXCLUDED: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      SHARE_SECRET: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      PIN_OVERRIDE: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      STASH_TAGS_INCLUDED: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      DEMO_MODE: envField.boolean({
        context: "server",
        access: "secret",
        optional: true,
        default: false,
      }),
    },
  },
});
