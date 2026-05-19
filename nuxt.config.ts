// https://nuxt.com/docs/api/configuration/nuxt-config
import path, { dirname, join } from "path";
import { fileURLToPath } from "url";

import tailwindcss from "@tailwindcss/vite";

const currentDir = dirname(fileURLToPath(import.meta.url));
const buildTime = process.env.BUILD_TIME ?? process.env.BUILD_DATE ?? new Date().toISOString();
const appVersion = process.env.APP_VERSION ?? process.env.npm_package_version ?? "unknown";
const commitSha =
  process.env.COMMIT_SHA ??
  process.env.GITHUB_SHA ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.COMMIT_REF ??
  "unknown";
const branchName =
  process.env.BRANCH_NAME ??
  process.env.GITHUB_REF_NAME ??
  process.env.VERCEL_GIT_COMMIT_REF ??
  "unknown";
const deployEnvironment =
  process.env.DEPLOY_ENVIRONMENT ??
  process.env.NODE_ENV ??
  process.env.CONTEXT ??
  "unknown";
const deployUrl = process.env.DEPLOY_URL ?? process.env.URL ?? "unknown";
const region = process.env.AWS_REGION ?? process.env.VERCEL_REGION ?? "unknown";

export default defineNuxtConfig({
  ssr: false,
  devtools: {
    enabled: process.env.NODE_ENV === "development",
  },
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
    public: {
      deploymentInfo: {
        appVersion,
        buildTime,
        commitSha,
        branchName,
        deployEnvironment,
        deployUrl,
        region,
        nodeVersion: process.version,
      },
    },
  },
  modules: [
    "@pinia/nuxt",
    "nuxt-auth-utils",
    "@nuxt/icon",
    ...(process.env.NODE_ENV === "development" ? ["@nuxt/devtools"] : []),
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

  nitro: {
    serveStatic: "inline",
    future: {
      nativeSWR: true,
    },
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },

  alias: {
    "@": path.resolve(currentDir),
    "@/src": path.resolve(currentDir, "src"),
  },

  css: ["~/assets/css/main.css"],

  vite: {
    plugins: [tailwindcss() as any],
     server: {
      allowedHosts: [".ngrok-free.app", ".ngrok-free.dev", ".trycloudflare.com",".oceanmdlabs.com"]
    }
  },

  devServer: {
    port: 4000,
  },

  compatibilityDate: "2025-01-12",
});
