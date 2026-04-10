import type { RoutingEventMessage } from "@/src/entities/models/routing-evaluation";
import type { CDSHookRequest } from "@/src/entities/models/cds-hooks";
import type {
  Bundle,
  MessageHeader,
  ServiceRequest,
  Patient,
  PractitionerRole,
  Practitioner,
  Location,
  FhirResource
} from "fhir/r4";
import { InvalidArgumentsError } from "@/src/entities/errors/common";

export function summarizeServiceRequestMessage(bundle: Bundle): string {
  if (!bundle || !bundle.entry) {
    return "No valid bundle found in message";
  }

  const resources = bundle.entry
    .map((e) => {
      return { id: e.fullUrl?.split(":").pop(), ...e.resource } as FhirResource;
    })
    .filter((r): r is FhirResource => r !== undefined);
  const messageHeader = resources.find(
    (r): r is MessageHeader => r.resourceType === "MessageHeader"
  );
  const serviceRequest = resources.find(
    (r): r is ServiceRequest => r.resourceType === "ServiceRequest"
  );
  const patient = resources.find(
    (r): r is Patient => r.resourceType === "Patient"
  );
  // const questionnaireResponse = resources.find(
  //   (r): r is QuestionnaireResponse =>
  //     r.resourceType === "QuestionnaireResponse"
  // );
  const practitionerRoles = resources.filter(
    (r): r is PractitionerRole => r.resourceType === "PractitionerRole"
  );
  const practitioners = resources.filter(
    (r): r is Practitioner => r.resourceType === "Practitioner"
  );
  const locations = resources.filter(
    (r): r is Location => r.resourceType === "Location"
  );

  let summary = "\n\nService Request Summary:\n";
  const serviceRequestSummary =
    prepareServiceRequestSummary(serviceRequest) ??
    serviceRequest?.note?.map((n) => n.text).join("\n");
  if (!serviceRequestSummary) {
    throw new InvalidArgumentsError("No service request summary found");
  } else {
    summary += `${serviceRequestSummary}\n`;
  }

  // Patient information (excluding PII)
  if (patient) {
    summary += "Patient:\n";
    if (patient.gender) {
      summary += `Gender: ${patient.gender}\n`;
    }
    if (patient.birthDate) {
      summary += `Age: ${calculateAge(patient.birthDate)}\n`;
    }
    // Check for email consent
    const hasEmail = patient.telecom?.some(
      (t) => t.system === "email" && t.value
    );
    summary += `Email Consent: ${hasEmail ? "TRUE" : "FALSE"}\n`;
    if (patient.generalPractitioner?.[0]?.reference) {
      const generalPractitioner = practitioners.find(
        (p) =>
          p.id ===
          extractResourceId(patient.generalPractitioner?.[0]?.reference)
      );
      if (generalPractitioner) {
        summary += `General Practitioner: ${generalPractitioner.name?.[0]?.given?.join(
          " "
        )} ${generalPractitioner.name?.[0]?.family}\n`;
      }
    }
  }

  if (messageHeader?.destination) {
    summary += `Destination: ${messageHeader.destination
      .map((d) => d.name)
      .join("; ")}\n`;
  }

  // Service Request information
  if (serviceRequest) {
    if (serviceRequest.category?.[0]?.coding?.[0]?.display) {
      const coding = serviceRequest.category[0].coding[0];
      summary += `Category: ${coding.display} (${coding.system} - ${coding.code})\n`;
    }

    // Add requester information
    if (serviceRequest.requester?.reference) {
      const requesterRole = practitionerRoles.find(
        (role) =>
          role.id === extractResourceId(serviceRequest.requester?.reference)
      );
      if (requesterRole) {
        const requester = practitioners.find(
          (p) =>
            p.id === extractResourceId(requesterRole.practitioner?.reference)
        );
        if (requester?.name?.[0]) {
          const name = [
            requester.name[0].given?.join(" "),
            requester.name[0].family
          ]
            .filter(Boolean)
            .join(" ");
          if (name) summary += `Referrer: ${name}\n`;
        }
      }
    }

    // Add performer information
    if (serviceRequest.performer?.[0]?.reference) {
      const performerRole = practitionerRoles.find(
        (role) =>
          role.id ===
          extractResourceId(serviceRequest.performer?.[0]?.reference)
      );
      if (performerRole) {
        const performer = practitioners.find(
          (p) =>
            p.id === extractResourceId(performerRole.practitioner?.reference)
        );
        if (performer?.name?.[0]) {
          const name = [
            performer.name[0].given?.join(" "),
            performer.name[0].family
          ]
            .filter(Boolean)
            .join(" ");
          if (name) summary += `Performer: ${name}\n`;
        }
      }
    }

    // Questionnaire Response information
    // if (questionnaireResponse?.item) {
    //   summary += "\nForm Answers:\n";
    //   questionnaireResponse.item.forEach((item) => {
    //     if (item.answer?.[0]?.valueString) {
    //       summary += `${item.linkId}: ${item.answer[0].valueString}\n`;
    //     }
    //   });
    // }

    // Practitioner and Location information
    if (practitionerRoles.length > 0) {
      summary += "\nProviders:\n";
      practitionerRoles.forEach((role) => {
        const practitioner = practitioners.find(
          (p) => p.id === extractResourceId(role.practitioner?.reference)
        );
        const location = locations.find(
          (l) => l.id === extractResourceId(role.location?.[0]?.reference)
        );

        if (practitioner) {
          if (practitioner.name?.[0]) {
            const name = [
              practitioner.name[0].given?.join(" "),
              practitioner.name[0].family
            ]
              .filter(Boolean)
              .join(" ");
            if (name) summary += `Name: ${name}\n`;
          }
        }

        if (role.identifier) {
          role.identifier.forEach((id) => {
            if (id.value)
              summary += `- ${id.system?.split("/").pop() || "Unknown"}: ${
                id.value
              }\n`;
          });
        }

        if (location) {
          if (location.address) {
            const address = [
              location.address.line?.join(", "),
              location.address.city,
              location.address.state,
              location.address.postalCode
            ]
              .filter(Boolean)
              .join(", ");
            if (address) summary += `Address: ${address}\n`;
          }
        }
      });
    }
  }
  return summary;
}

function calculateAge(birthDateStr: string) {
  const today = new Date();
  const birthDate = new Date(birthDateStr);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function extractResourceId(reference?: string): string | undefined {
  if (!reference) return undefined;
  // Handle both formats: "ResourceType/id" and "ResourceType:uuid"
  const parts = reference.split(/[\/:]/);
  return parts[parts.length - 1];
}

function prepareServiceRequestSummary(
  serviceRequest: ServiceRequest | undefined
): string {
  const text =
    serviceRequest?.text?.div ??
    serviceRequest?.note?.map((n) => n.text).join("\n") ??
    "";

  // Strip specific HTML formatting tags and replace <br> with newlines
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(b|i|u|font)(\s[^>]*)?>/gi, "");
}
