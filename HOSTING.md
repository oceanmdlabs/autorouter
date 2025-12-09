## Hosting the Autorouter Application

### Introduction

This guide outlines the hosting options for the Autorouter application. Whether you're a technical team member or a stakeholder evaluating deployment options, this document will help you understand what's needed to get the application running in production.

As an open-source project, the Autorouter is highly flexible and can be adapted to work with your organization's existing infrastructure and preferred cloud providers. While we list specific services below, the application can be modified to integrate with alternative services that meet your needs.

**Popular Hosting Providers:** Based on ease of deployment and feature compatibility, we recommend considering **Google Cloud Platform**, **AWS**, **Azure**, or **Netlify** as your primary hosting options. Each provider offers Canadian hosting and excellent support for modern web applications, with varying levels of complexity and cost.

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


### Google Cloud Platform Deployment

The Autorouter has been successfully deployed on Google Cloud.

**Required Services:**

- **Cloud Run** or **App Engine** - For Nuxt SSR application with Node.js runtime
- **Cloud SQL for PostgreSQL** - Managed database service

**AI Hosting Options:**

- **Vertex AI** - Google's AI platform (Gemini models)
- **Google AI Studio** - Direct API access
- External providers (Azure OpenAI, Cohere)

### AWS Deployment

**Required Services:**

- **AWS Amplify Hosting** - https://nuxt.com/deploy/aws-amplify
- **Amazon RDS for PostgreSQL** (Serverless v2) or **Aurora Serverless PostgreSQL** - Database

**AI Hosting Options:**

- Amazon Bedrock (for Claude, other models)
- OpenAI API (external)
- Azure OpenAI (external)

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