import dotenv from "dotenv";
dotenv.config();

// Set dummy DB_URL if not provided (not needed for this test)
if (!process.env.DB_URL) {
  process.env.DB_URL = "postgresql://dummy:dummy@localhost:5432/dummy";
}

// Set dummy DEPLOY_URL if not provided (needed by ocean-message.service)
if (!process.env.DEPLOY_URL) {
  process.env.DEPLOY_URL = process.env.URL || "http://localhost:4000";
}

import { ApplicationContext } from "../entities/models/application-context.js";
import { createOceanClientService } from "../infrastructure/services/ocean-client.service.js";
import { createSendCommunicationMessage } from "../infrastructure/services/ocean-message.service.js";
import type { OceanClientCredentials } from "../application/services/ocean-client.service.interface.js";
import type { OceanServer } from "../application/services/ocean-server.utils.js";
import type { Bundle } from "fhir/r4";
import fs from "node:fs";
import path from "node:path";

const logger = {
  info: console.info,
  error: console.error,
  warn: console.warn,
  debug: console.debug,
  log: console.log,
};

async function main() {
  // Validate required environment variables
  const oceanServer = (process.env.OCEAN_SERVER || "test") as OceanServer;
  const oceanClientId = process.env.OCEAN_CLIENT_ID;
  const oceanClientSecret = process.env.OCEAN_CLIENT_SECRET;

  if (!oceanClientId || !oceanClientSecret) {
    console.error(
      "\n❌ Missing required environment variables in .env file:\n" +
        "   - OCEAN_CLIENT_ID\n" +
        "   - OCEAN_CLIENT_SECRET\n" +
        "   - OCEAN_SERVER (optional, defaults to 'test')\n\n" +
        "Please add these to your .env file and try again."
    );
    process.exit(1);
  }

  console.log("\n🚀 Testing Send Communication Handler");
  console.log("=====================================\n");
  console.log(`Ocean Server: ${oceanServer}`);
  console.log(`Client ID: ${oceanClientId.substring(0, 8)}...`);

  // Create application context
  const context = new ApplicationContext(logger);

  // Create credentials object
  const credentials: OceanClientCredentials = {
    oceanServer,
    oceanClientId,
    oceanClientSecret,
  };

  // Create ocean client service
  const oceanClientService = createOceanClientService({ cxt: context });

  // Test the connection first
  console.log("\n📡 Testing Ocean connection...");
  try {
    const testResult = await oceanClientService.testConnection(credentials);
    if (testResult.ok) {
      console.log("✅ Connection successful!");
    } else {
      console.error(
        `❌ Connection failed: ${testResult.status} ${testResult.statusText}`
      );
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Connection test failed:", error);
    process.exit(1);
  }

  // Load sample service request bundle
  console.log("\n📄 Loading sample service request bundle...");
  const sampleBundlePath = path.join(
    process.cwd(),
    "test",
    "ereferral_miscellaneous.bundle.json"
  );

  if (!fs.existsSync(sampleBundlePath)) {
    console.error(`❌ Sample bundle not found at: ${sampleBundlePath}`);
    process.exit(1);
  }

  const sampleBundleJson = fs.readFileSync(sampleBundlePath, "utf-8");
  const serviceRequestBundle: Bundle = JSON.parse(sampleBundleJson);
  console.log(
    `✅ Loaded bundle with ${serviceRequestBundle.entry?.length} entries`
  );

  // Create a communication message
  const messageText =
    process.env.TEST_MESSAGE ||
    "This is a test communication message sent from the autorouter test script.";

  console.log(`\n💬 Creating communication message...`);
  console.log(`   Message: "${messageText}"`);

  const communicationMessage = createSendCommunicationMessage(
    serviceRequestBundle,
    { message: messageText }
  );

  console.log(
    `✅ Created message bundle with ${communicationMessage.entry?.length} entries`
  );

  // Display message header details
  const messageHeader = communicationMessage.entry?.find(
    (e) => e.resource?.resourceType === "MessageHeader"
  )?.resource;
  if (messageHeader) {
    console.log(`   Event: ${(messageHeader as any).eventCoding?.code}`);
    console.log(`   Message ID: ${messageHeader.id}`);
  }

  // Display communication details
  const communication = communicationMessage.entry?.find(
    (e) => e.resource?.resourceType === "Communication"
  )?.resource;
  if (communication) {
    console.log(`   Communication ID: ${communication.id}`);
  }

  // Send the message
  console.log("\n📤 Sending message to Ocean...");
  try {
    const response = await oceanClientService.sendMessage({
      message: communicationMessage,
      credentials,
    });

    console.log(`\n📬 Response received:`);
    console.log(`   Status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      console.log("✅ Message sent successfully!");
      try {
        const responseBody = await response.json();
        console.log("\n📦 Response body:");
        console.log(JSON.stringify(responseBody, null, 2));
      } catch (e) {
        // Response might not have JSON body
        console.log("   (No JSON response body)");
      }
    } else {
      console.error("❌ Message send failed!");
      try {
        const errorBody = await response.text();
        console.error(`   Error: ${errorBody}`);
      } catch (e) {
        // Ignore if we can't read error body
      }
      process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ Failed to send message:", error);
    process.exit(1);
  }

  console.log("\n✨ Test completed successfully!\n");
}

// Run the test
main().catch((error) => {
  console.error("\n💥 Unexpected error:", error);
  process.exit(1);
});
