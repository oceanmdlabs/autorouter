// https://nuxt.com/docs/api/configuration/nuxt-config
import path, { dirname, join } from "path";
import { fileURLToPath } from "url";

import tailwindcss from "@tailwindcss/vite";

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineNuxtConfig({
  ssr: true,
  // devtools: {
  //   vscode: {
  //     reuseExistingServer: true,
  //     port: 3090, // Replace with your desired port
  //   },
  // },

  runtimeConfig: {
    oauth: {
      github: {
        clientId: process.env.NUXT_OAUTH_GITHUB_CLIENT_ID,
        clientSecret: process.env.NUXT_OAUTH_GITHUB_CLIENT_SECRET,
      },
      google: {
        clientId: process.env.NUXT_OAUTH_GOOGLE_CLIENT_ID,
        clientSecret: process.env.NUXT_OAUTH_GOOGLE_CLIENT_SECRET,
      },
    },
  },
  modules: [
    "@pinia/nuxt",
    "nuxt-auth-utils",
    "@nuxt/icon",
    "@nuxt/devtools",
    "shadcn-nuxt",
    "@nuxtjs/color-mode",
    "nuxt-lucide-icons",
  ],

  lucide: {
    namePrefix: "Icon",
  },

  app: {
    // https://nuxt.com/docs/getting-started/transitions#page-transitions
    pageTransition: { name: "page", mode: "out-in" },
    layoutTransition: { name: "layout", mode: "out-in" },
  },

  shadcn: {
    prefix: "./components",
    componentDir: "./components/ui",
  },

  nitro: {
    future: {
      nativeSWR: true,
    },
  },

  typescript: {
    strict: true,
    typeCheck: "build",
  },

  alias: {
    "@": path.resolve(currentDir),
    "@/src": path.resolve(currentDir, "src"),
  },

  css: ["~/assets/css/main.css"],

  vite: {
    plugins: [tailwindcss()],
  },

  devServer: {
    port: 4000,
  },

  compatibilityDate: "2025-01-12",
});
