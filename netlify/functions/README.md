# Netlify Background Functions

This directory contains Netlify background functions for asynchronous processing.

Note that this functionality requires a PAID Netlify plan.

All other serverless functions are handled by the Nuxt framework in the api directory.

## FHIR Background Function

The `fhir-background.ts` function processes FHIR requests asynchronously. It's triggered by the `/fhir/async/*` endpoint.

### How it works:

1. **Async Endpoint**: `/fhir/async/*` - Receives FHIR requests and immediately returns a 200 response
2. **Background Processing**: The request is forwarded to the background function for processing
3. **Non-blocking**: The client doesn't wait for the background processing to complete

### Usage:

```bash
# Instead of calling the synchronous endpoint
POST /fhir/Patient

# Call the async endpoint
POST /fhir/async/Patient
```

### Response Format:

The async endpoint returns immediately with:

```json
{
  "success": true,
  "message": "Request queued for background processing",
  "requestId": "req_1234567890_abc123def",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Configuration:

The functions are configured in `netlify.toml`:

```toml
[functions]
  directory = "netlify/functions"
```

### Development:

To test locally:

1. Start the development server: `npm run dev`
2. The background function will be available at `/.netlify/functions/fhir-background`
3. The async endpoint will be available at `/fhir/async/*`

### Production:

In production, Netlify will automatically deploy and manage the background functions. The functions will be available at:

- `https://your-site.netlify.app/.netlify/functions/fhir-background`

### Error Handling:

- If the background function fails to trigger, the async endpoint still returns success
- Background function errors are logged but don't affect the client response
- The background function itself handles errors and logs them appropriately
