import type { Bundle, FhirResource } from "fhir/r4";
import {
  createMessageBundle,
  createMessageHeader,
  createTask,
  getReferralRef,
  prepareResourcesForResponse,
  type TaskStatus,
} from "./primitives";

export function createToggleEConsultMessage(
  serviceRequestBundle: Bundle,
  { changeToEConsult }: { changeToEConsult: boolean }
): Bundle<FhirResource> {
  const resources = prepareResourcesForResponse(serviceRequestBundle);
  const existingTask = resources.find(
    (resource) => resource.resourceType === "Task"
  );
  const wasEConsult =
    existingTask?.code?.coding?.[0]?.code === "process-request-consult";
  const task = createTask({
    status: existingTask?.status as TaskStatus,
    code: wasEConsult ? "process-request-consult" : "process-request",
    identifier: existingTask?.identifier,
  });
  task.extension = [
    {
      url: "http://ehealthontario.ca/fhir/StructureDefinition/ca-on-eConsult-ext-patient-needs-to-be-seen",
      valueBoolean: !changeToEConsult,
    },
  ];
  return createMessageBundle({
    resources: [
      createMessageHeader({
        eventCode: "notify-update-process-request",
        referralRef: getReferralRef(serviceRequestBundle),
        focus: [{ reference: "Task/" + task.id }],
      }),
      ...resources,
      task,
    ],
  });
}
