# Netlify Platform Adapters

This directory contains platform-specific adapters for Netlify's serverless infrastructure. These adapters follow clean architecture principles by keeping platform-specific code in the infrastructure layer.

## Architecture

```
src/infrastructure/adapters/netlify/
├── index.ts   # Exports for the adapters
└── README.md  # This file
```

## Clean Architecture Benefits

1. **Separation of Concerns**: Platform-specific code is isolated in the infrastructure layer
2. **Testability**: Core business logic remains independent of platform details
3. **Portability**: Easy to swap out Netlify for other platforms if needed
4. **Maintainability**: Clear boundaries between application logic and infrastructure
