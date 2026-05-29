## Hosting the Autorouter Application

### Introduction

This guide outlines the hosting options for the Autorouter application. Whether you're a technical team member or a stakeholder evaluating deployment options, this document will help you understand what's needed to get the application running in production.

As an open-source project, the Autorouter is highly flexible and can be adapted to work with your organization's existing infrastructure and preferred cloud providers. While we list specific services below, the application can be modified to integrate with alternative services that meet your needs.

**Popular Hosting Providers:** Based on ease of deployment and feature compatibility, we recommend considering **AWS**, **Google Cloud Platform**, **Azure**, or **Netlify** as your primary hosting options. Each provider offers Canadian hosting and excellent support for modern web applications, with varying levels of complexity and cost.

### General Requirements

To host the Autorouter application, you'll need the following infrastructure components:

**Core Infrastructure:**

- **Serverless PostgreSQL Database** - A managed PostgreSQL instance compatible with Drizzle ORM
- **Serverless Web Application Hosting** - Platform with Nuxt deployment support (https://nuxt.com/deploy)
- **AI Model Hosting** - An LLM that is accessible using the AI SDK (https://ai-sdk.dev/docs/foundations/providers-and-models)

**AI Model Hosting:**

- **AI Provider API Access** - One or more of the following:
  - Azure OpenAI Service
  - Google AI (Gemini)
  - Cohere
  - OpenAI API

The AI provider can be hosted on your own Canadian infrastructure or on the cloud provider of your choice.

**External Services:**

The following external services are also used:

- **OAuth Provider** - Support for Google and/or GitHub authentication (requires app registration with the provider)
- **SMS Service (optional)** - Twilio account for SMS notifications
- **Email Service (optional)** - Email service for email notifications

The code can be modified to use alternative OAuth providers, email and SMS services on your own infrastructure if required.

### Tenant-Level AI, Email, and SMS Configuration

AI, Email, and SMS infrastructure is configured at the application tenant level by each tenant administrator, not by the cloud hosting provider. This allows each tenant to use its own model provider and communication services.

A hosting provider can still provision these services and have its own tenant point to them. For example, an AWS-hosted deployment can use AWS-provisioned LLM, SMS, and email services for that tenant.

Review [docs/privacy-considerations.md](docs/privacy-considerations.md) before configuring AI processing for real patient data, especially if rules analyze referral attachments.

### AWS Deployment

For AWS deployments, use the CDK guide in this repository:

- [infrastructure/cdk/README.md](infrastructure/cdk/README.md)

This is the primary and current AWS deployment path for the Autorouter.

Important first-run step:
- After the first successful deployment, sign in once with the Google or GitHub account that should become the first system admin.
- That first login creates the user record and determines the admin allowlist identifier:
  - Google: OAuth `sub`
  - GitHub: numeric OAuth `user.id` stored as text
- On a new environment, the app may reject that first login before a normal session is created. Use a database lookup to get the identifier:
  - `npm run db:sql:aws -- --sql "select provider, subject, display_name, last_login_at from users order by last_login_at desc nulls last, created_at desc limit 10;"`
  - Pick the row for the account you just used to sign in.
- Then add that `provider` + `subject` pair to `system_admin_allowlist` and log out / log back in.
- The AWS CDK deploy scripts print these post-deploy instructions automatically.


### Google Cloud Platform Deployment

The Autorouter has been successfully deployed on Google Cloud.

**Required Services:**

- **Cloud Run** or **App Engine** - For Nuxt SSR application with Node.js runtime
- **Cloud SQL for PostgreSQL** - Managed database service

**AI Hosting Options:**

- **Vertex AI** - Google's AI platform (Gemini models)
- **Google AI Studio** - Direct API access
- External providers (Azure OpenAI, Cohere)

### Azure Deployment

**Required Services:**

- **Azure Static Web Apps**  - For Nuxt SSR applications (https://nuxt.com/deploy/azure)
- **Azure Database for PostgreSQL Flexible Server** - Serverless-capable database

**AI Hosting Options:**

- **Azure OpenAI Service** - Recommended for GPT models
- OpenAI API (external)
- Google AI (external)

**Additional Requirements:**

- Twilio account (external) for SMS

### Netlify Deployment

Netlify offers an excellent developer experience with automatic deployments from Git, serverless functions, and a generous free tier. However, the Postgres and AI model must be hosted by another provider.

**Required Services:**

- **Netlify Hosting** - Native Nuxt SSR support with serverless functions
- **External PostgreSQL** - Serverless-capable database (note: Neon does not currently provide Canadian hosting)

**AI Hosting Options:**

- OpenAI API (external)
- Azure OpenAI (external)
- Google AI (external)
- Cohere (external)

**Additional Requirements:**

- Twilio account (external) for SMS
