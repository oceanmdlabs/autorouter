import type { Bundle } from "fhir/r4";
import {
  createMessageBundle,
  createMessageHeader,
  createTask,
  getReferralRef,
  prepareResourcesForResponse,
  type TaskStatus,
} from "./primitives";

export function createStatusChangeMessage(
  serviceRequestBundle: Bundle,
  {
    status,
    reason,
    description,
  }: { status: TaskStatus; reason: string; description: string }
): Bundle {
  const resources = prepareResourcesForResponse(serviceRequestBundle);
  const task = createTask({
    status,
    reason,
    description,
    code: "process-request",
  });
  return createMessageBundle({
    resources: [
      createMessageHeader({
        eventCode: "notify-update-process-request",
        referralRef: getReferralRef(serviceRequestBundle),
        focus: [{ reference: "Task/" + task.id }],
      }),
      task,
      ...resources,
    ],
  });
}
