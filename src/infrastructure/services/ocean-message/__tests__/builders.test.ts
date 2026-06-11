import fs from "fs";
import path from "path";
import type { Bundle, Communication, MessageHeader, Task } from "fhir/r4";
import { describe, expect, it } from "vitest";

process.env.DEPLOY_URL = "http://localhost:4000";

function loadFixture(name: string): Bundle {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "test", name), "utf-8")
  );
}

describe("createForwardMessage", () => {
  it("sets notify-update-process-request event and includes forwardTo PractitionerRole", async () => {
    const { createForwardMessage } = await import("../forward-assign");
    const bundle = loadFixture("ereferral_miscellaneous.bundle.json");
    const result = createForwardMessage(bundle, {
      forwardToListingRef: "listing-123",
    });

    const header = result.entry?.find(
      (e) => e.resource?.resourceType === "MessageHeader"
    )?.resource as MessageHeader;
    expect(header.eventCoding?.code).toBe("notify-update-process-request");

    const forwardTo = result.entry?.find(
      (e) =>
        e.resource?.resourceType === "PractitionerRole" &&
        e.resource.identifier?.[0]?.system === "id-referral-target-reference"
    )?.resource;
    expect(forwardTo?.identifier?.[0]?.value).toBe("listing-123");
  });

  it("places a Task in focus referencing the updated ServiceRequest", async () => {
    const { createForwardMessage } = await import("../forward-assign");
    const bundle = loadFixture("ereferral_miscellaneous.bundle.json");
    const result = createForwardMessage(bundle, {
      forwardToListingRef: "listing-abc",
    });

    const header = result.entry?.find(
      (e) => e.resource?.resourceType === "MessageHeader"
    )?.resource as MessageHeader;
    const task = result.entry?.find(
      (e) => e.resource?.resourceType === "Task"
    )?.resource as Task;

    expect(header.focus?.[0]?.reference).toBe("Task/" + task.id);
    expect(task.basedOn?.[0]?.reference).toMatch(/^ServiceRequest\//);
  });
});

describe("createStatusChangeMessage", () => {
  it("sets the task status and reason, with notify-update-process-request event", async () => {
    const { createStatusChangeMessage } = await import("../status-change");
    const bundle = loadFixture("ereferral_miscellaneous.bundle.json");
    const result = createStatusChangeMessage(bundle, {
      status: "accepted",
      reason: "Capacity available",
      description: "Referral accepted",
    });

    const header = result.entry?.find(
      (e) => e.resource?.resourceType === "MessageHeader"
    )?.resource as MessageHeader;
    expect(header.eventCoding?.code).toBe("notify-update-process-request");

    const task = result.entry?.find(
      (e) => e.resource?.resourceType === "Task"
    )?.resource as Task;
    expect(task.status).toBe("accepted");
    expect(task.statusReason?.text).toBe("Capacity available");
  });
});

describe("createSetBookingInstructionsMessage", () => {
  it("sets notify-add-appointment event with the message as description and patientInstruction", async () => {
    const { createSetBookingInstructionsMessage } = await import(
      "../booking-instructions"
    );
    const bundle = loadFixture("ereferral_miscellaneous.bundle.json");
    const result = createSetBookingInstructionsMessage(bundle, {
      message: "Please arrive 15 minutes early.",
    });

    const header = result.entry?.find(
      (e) => e.resource?.resourceType === "MessageHeader"
    )?.resource as MessageHeader;
    expect(header.eventCoding?.code).toBe("notify-add-appointment");

    const appointment = result.entry?.find(
      (e) => e.resource?.resourceType === "Appointment"
    )?.resource;
    expect(appointment?.description).toBe("Please arrive 15 minutes early.");
    expect(appointment?.patientInstruction).toBe(
      "Please arrive 15 minutes early."
    );
  });
});

describe("createSendCommunicationMessage", () => {
  it("sets send-communication event with autorouter sender", async () => {
    const { createSendCommunicationMessage } = await import("../communications");
    const bundle = loadFixture("ereferral_miscellaneous.bundle.json");
    const result = createSendCommunicationMessage(bundle, {
      message: "Hello from autorouter.",
    });

    const header = result.entry?.find(
      (e) => e.resource?.resourceType === "MessageHeader"
    )?.resource as MessageHeader;
    expect(header.eventCoding?.code).toBe("send-communication");

    const communication = result.entry?.find(
      (e) => e.resource?.resourceType === "Communication"
    )?.resource as Communication;
    expect(communication.payload?.[0]?.contentString).toBe(
      "Hello from autorouter."
    );
    expect(communication.sender?.reference).toBe(
      "PractitionerRole/autorouter-sender"
    );
  });
});

describe("createSendCommunicationFromProviderMessage", () => {
  it("sets send-communication-from-provider event and no sender on the communication", async () => {
    const { createSendCommunicationFromProviderMessage } = await import(
      "../communications"
    );
    const bundle = loadFixture("ereferral_miscellaneous.bundle.json");
    const result = createSendCommunicationFromProviderMessage(bundle, {
      message: "Provider note.",
    });

    const header = result.entry?.find(
      (e) => e.resource?.resourceType === "MessageHeader"
    )?.resource as MessageHeader;
    expect(header.eventCoding?.code).toBe("send-communication-from-provider");

    const communication = result.entry?.find(
      (e) => e.resource?.resourceType === "Communication"
    )?.resource as Communication;
    expect(communication.sender).toBeUndefined();
  });
});

describe("createSendCommunicationFromRequesterMessage", () => {
  it("sets send-communication-from-requester event", async () => {
    const { createSendCommunicationFromRequesterMessage } = await import(
      "../communications"
    );
    const bundle = loadFixture("ereferral_miscellaneous.bundle.json");
    const result = createSendCommunicationFromRequesterMessage(bundle, {
      message: "Requester note.",
    });

    const header = result.entry?.find(
      (e) => e.resource?.resourceType === "MessageHeader"
    )?.resource as MessageHeader;
    expect(header.eventCoding?.code).toBe(
      "send-communication-from-requester"
    );
  });
});

describe("createToggleEConsultMessage", () => {
  it("sets the patient-needs-to-be-seen extension to false when toggling to eConsult", async () => {
    const { createToggleEConsultMessage } = await import("../econsult-toggle");
    const bundle = loadFixture("ereferral_miscellaneous.bundle.json");
    const result = createToggleEConsultMessage(bundle, {
      changeToEConsult: true,
    });

    const task = result.entry?.find(
      (e) => e.resource?.resourceType === "Task"
    )?.resource as Task;
    const ext = task.extension?.find((e) =>
      e.url.includes("ca-on-eConsult-ext-patient-needs-to-be-seen")
    );
    expect(ext?.valueBoolean).toBe(false);
  });

  it("sets the patient-needs-to-be-seen extension to true when toggling away from eConsult", async () => {
    const { createToggleEConsultMessage } = await import("../econsult-toggle");
    const bundle = loadFixture("ereferral_miscellaneous.bundle.json");
    const result = createToggleEConsultMessage(bundle, {
      changeToEConsult: false,
    });

    const task = result.entry?.find(
      (e) => e.resource?.resourceType === "Task"
    )?.resource as Task;
    const ext = task.extension?.find((e) =>
      e.url.includes("ca-on-eConsult-ext-patient-needs-to-be-seen")
    );
    expect(ext?.valueBoolean).toBe(true);
  });
});

describe("createDataCorrectionMessageWithNewCode", () => {
  it("sets notify-data-correction event and updates the service request code", async () => {
    const { createDataCorrectionMessageWithNewCode } = await import(
      "../data-correction"
    );
    const bundle = loadFixture("ereferral_miscellaneous.bundle.json");
    const newCode = {
      coding: [
        {
          system: "http://snomed.info/sct",
          code: "999999",
          display: "Test code",
        },
      ],
    };
    const result = await createDataCorrectionMessageWithNewCode(
      bundle,
      newCode
    );

    const header = result.entry?.find(
      (e) => e.resource?.resourceType === "MessageHeader"
    )?.resource as MessageHeader;
    expect(header.eventCoding?.code).toBe("notify-data-correction");

    const serviceRequest = result.entry?.find(
      (e) => e.resource?.resourceType === "ServiceRequest"
    )?.resource;
    const hasNewCode = serviceRequest?.code?.coding?.some(
      (c: { system?: string; code?: string }) =>
        c.system === "http://snomed.info/sct" && c.code === "999999"
    );
    expect(hasNewCode).toBe(true);
  });
});
