// https://nuxt.com/docs/api/configuration/nuxt-config
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { defineNuxtConfig } from "nuxt/config";

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

  nitro: {
    future: {
      nativeSWR: true
    }
  },

  runtimeConfig: {
    oauth: {
      github: {
        clientId: process.env.NUXT_OAUTH_GITHUB_CLIENT_ID,
        clientSecret: process.env.NUXT_OAUTH_GITHUB_CLIENT_SECRET
      },
      google: {
        clientId: process.env.NUXT_OAUTH_GOOGLE_CLIENT_ID,
        clientSecret: process.env.NUXT_OAUTH_GOOGLE_CLIENT_SECRET
      }
    },

    // https://firebase.google.com/docs/hosting/manage-cache#using_cookies
    // https://nuxt.com/modules/auth-utils#configuration
    session: {
      name: "__session",
      password: process.env.NUXT_SESSION_PASSWORD || "",
      cookie: {
        sameSite: "lax"
      }
    },

    public: {
      siteUrl: "https://autorouter.snowdog.health"
    }
  },

  modules: [
    "@pinia/nuxt",
    "nuxt-auth-utils",
    "@nuxt/icon",
    "@nuxt/devtools",
    [
      "shadcn-nuxt",
      { prefix: "./components", componentDir: "./components/ui" }
    ],
    "@nuxtjs/color-mode",
    ["nuxt-lucide-icons", { namePrefix: "Icon" }]
  ],

  app: {
    // https://nuxt.com/docs/getting-started/transitions#page-transitions
    pageTransition: { name: "page", mode: "out-in" },
    layoutTransition: { name: "layout", mode: "out-in" },
    head: {
      title: "SnowDog AutoRouter – eReferral Automation"
    }
  },

  typescript: {
    strict: true,
    typeCheck: "build"
  },

  alias: {
    "@": path.resolve(currentDir),
    "@/src": path.resolve(currentDir, "src")
  },

  css: ["~/assets/css/main.css"],

  vite: {
    plugins: [tailwindcss()],
    server: {
      allowedHosts: [".ngrok-free.app", ".ngrok-free.dev"]
    }
  },

  devServer: {
    port: 4000
  },

  compatibilityDate: "2025-01-12"
});
