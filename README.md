# Ocean Autorouter

## Overview

The Autorouter is a standalone web application that integrates with your Ocean site to enable
intelligent, rules-based automation for managing eReferral workflows. It uses AI to analyze
referrals in real-time and take predefined routing actions—reducing administrative workload,
improving response time, and supporting virtual care models.

## Tech Stack

- [Nuxt](https://nuxt.com/)

- [Tailwind CSS](https://tailwindcss.com/)

- [Vue.js](https://vuejs.org/)

- [TypeScript](https://www.typescriptlang.org/)

- [Drizzle ORM](https://orm.drizzle.team/)

- [Postgres](https://www.postgresql.org/)

- [Neon (for serverless Postgres)](https://neon.tech/)

- [AI SDK](https://www.npmjs.com/package/ai)

# Nuxt Framework

Nuxt is a framework for building web applications. It is built on top of Vue.js and provides a lot of features for building web applications. It is similar to Next.js, but for Vue.js instead of React.

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev
```

### Debugging

To debug the application, use the "Nuxt: Server" debug target in Cursor / VSCode.

Check the launch.json file in the .vscode folder for more debugging options.

### Database Schema Updates

The database schema is specified in the schema.ts file in the drizzle folder.

To instantly create or update the database schema via Drizzle', run the following command:

```bash
npm run push
```

(Note: Drizzle Push is generally considered dangerous for making schema changes in production, but is useful for quick development.)

Check the tasks.json file in the .vscode folder for more details.

### Development Overview

The project's architecture uses the [Clean Architecture pattern](https://dev.to/dvorlandi/implementing-clean-architecture-with-typescript-3jpc) to separate concerns and make the code more testable and maintainable.

Business logic is separated from the infrastructure layer.

The UI is predominantly built with agentic coding (Cursor) using ShadCn Vue components.

The project has a number of Cursor rules to facilitate development and improve adherence to the Clean Architecture pattern.

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

The application is currently deployed to Netlify automatically via CI/CD with Git repository integration.
```

## Using the Autorouter

### How the AI Works

Once configured, the Autorouter monitors events related to eReferrals and eConsults (e.g., submissions,
cancellations, updates) and uses AI to analyze the referral’s contents (form data, patient details,
provider info) in real time.

The AI then matches this against user-defined rules and takes routing actions in your Ocean site
via secure API connections.

### Accessing the Autorouter

The Autorouter is separate from the Ocean Portal and requires a Google or GitHub account to
log in.

### What You'll Need

• A Google or GitHub account (can be personal, shared, or one-off).
• Your Ocean site number.
• Access to your Ocean Admin Portal to generate OAuth credentials.

### Connecting the Autorouter to your Ocean Site

1. Go to https://ocean-autorouter.netlify.app/login and sign in with a Google or GitHub
   account.
2. In the Ocean Portal OAuth Settings, create a Client ID and Secret.

### Generating Ocean OAuth Credentials

Systems must send Ocean a site-specific Client ID and secret in order to receive an OAuth
token(s) that can be used to submit referral updates for that Ocean site. To generate the Client
ID and secret:

1. From the Admin Settings page, click Manage Credentials > Manage OAuth
   Credentials button.
