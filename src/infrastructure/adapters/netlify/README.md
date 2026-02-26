# Netlify Platform Adapters

This directory contains platform-specific adapters for Netlify's serverless infrastructure. These adapters follow clean architecture principles by keeping platform-specific code in the infrastructure layer.

## Architecture

```
src/infrastructure/adapters/netlify/
├── functions/           # Netlify serverless functions
│   └── fhir-background.ts
├── index.ts            # Exports for the adapters
└── README.md           # This file
```

## Background Functions

### FHIR Background Function (`functions/fhir-background.ts`)

A Netlify background function that processes FHIR requests asynchronously.

**Purpose**: Bridge the application's FHIR processing logic with Netlify's serverless infrastructure.

**Key Features**:

- Uses the same `fhirController` as the main application
- Creates its own `ApplicationContext` for background processing
- Handles Netlify-specific event types and responses
- Maintains clean architecture by keeping platform code isolated

**Usage**: Triggered by the `/fhir/async/*` endpoint via HTTP POST.

## Clean Architecture Benefits

1. **Separation of Concerns**: Platform-specific code is isolated in the infrastructure layer
2. **Testability**: Core business logic remains independent of platform details
3. **Portability**: Easy to swap out Netlify for other platforms if needed
4. **Maintainability**: Clear boundaries between application logic and infrastructure

## Configuration

The functions are configured in `netlify.toml`:

```toml
[functions]
  directory = "src/infrastructure/adapters/netlify/functions"
```

## Development

To test locally:

1. Start the development server: `npm run dev`
2. The background function will be available at `/api/fhir-background`
3. The async endpoint will be available at `/fhir/async/*`

## Production

In production, Netlify will automatically deploy and manage the background functions from the configured directory.

**Note**: Background functions require a PAID Netlify plan.

## Error Handling

- Background function errors are logged but don't affect the client response
- The function itself handles errors and returns appropriate HTTP status codes
- Application context is properly initialized for error handling
