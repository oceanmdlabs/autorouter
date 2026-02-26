# Test Scripts

This directory contains various test scripts for the Ocean Autorouter application.

## test-send-communication.ts

Tests the `sendCommunicationHandler` by sending a test communication message to an Ocean site.

### Prerequisites

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure your `.env` file with Ocean credentials:
   ```env
   OCEAN_SERVER=test
   OCEAN_CLIENT_ID=your_client_id
   OCEAN_CLIENT_SECRET=your_client_secret
   ```

   Available `OCEAN_SERVER` values:
   - `test` - Ocean test environment (default)
   - `staging` - Ocean staging environment
   - `ocean` - Ocean production environment
   - `local` - Local Ocean instance (http://localhost:8080)

3. Optional: Set a custom test message:
   ```env
   TEST_MESSAGE=Your custom test message here
   ```

### Running the Test

```bash
npm run test:send-communication
```

### What It Does

The script will:

1. Load credentials from `.env`
2. Test the connection to Ocean
3. Load a sample service request bundle from `test/ereferral_miscellaneous.bundle.json`
4. Create a communication message using `ocean-message.service.ts`
5. Send the message via `ocean-client-service`
6. Display the response

### Expected Output

```
🚀 Testing Send Communication Handler
=====================================

Ocean Server: test
Client ID: abcd1234...

📡 Testing Ocean connection...
✅ Connection successful!

📄 Loading sample service request bundle...
✅ Loaded bundle with 25 entries

💬 Creating communication message...
   Message: "This is a test communication message sent from the autorouter test script."
✅ Created message bundle with 26 entries
   Event: send-communication-from-provider
   Message ID: abc-123-def-456
   Communication ID: xyz-789-ghi-012

📤 Sending message to Ocean...

📬 Response received:
   Status: 200 OK
✅ Message sent successfully!

✨ Test completed successfully!
```

### Troubleshooting

**Missing credentials error:**
```
❌ Missing required environment variables in .env file:
   - OCEAN_CLIENT_ID
   - OCEAN_CLIENT_SECRET
```

Solution: Add the required credentials to your `.env` file.

**Connection failed:**
```
❌ Connection failed: 401 Unauthorized
```

Solution: Verify your `OCEAN_CLIENT_ID` and `OCEAN_CLIENT_SECRET` are correct.

**Sample bundle not found:**
```
❌ Sample bundle not found at: /path/to/test/ereferral_miscellaneous.bundle.json
```

Solution: Ensure the test bundle file exists in the `test/` directory.
