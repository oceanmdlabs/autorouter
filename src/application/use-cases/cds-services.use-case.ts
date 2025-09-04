import type { ApplicationContext } from "@/src/entities/models/application-context";
import type {
  CDSService,
  CDSServiceDiscovery,
} from "@/src/entities/models/cds-hooks";

export const ORDER_SIGN_CDS_ID = "order-sign-cds";

// https://cds-hooks.hl7.org/2.0/
// https://cds-hooks.org/cheat-sheet/Cheat%20Sheet%20-%20Sept%202019.pdf

// https://fhir-org-cds-services.appspot.com/cds-services
// https://chat.fhir.org/#narrow/stream/179159-cds-hooks

// https://sandbox.cds-hooks.org/

interface Deps {
  cxt: ApplicationContext;
}

export async function cdsServices({
  deps: { cxt },
}: {
  deps: Deps;
}): Promise<CDSServiceDiscovery> {
  // https://cds-hooks.org/specification/current/
  cxt.logger.info(`cds-services-handler`);
  // this id is shared across both order hooks: https://cds-hooks.hl7.org/2.0/#update-stale-guidance
  // "Note that a CDS server can host multiple entries of CDS service with the same id for different hooks. This allows a service to update its advice based on changes in workflow"

  const services: CDSService[] = [
    {
      hook: "order-sign",
      title: "Ocean CDS Service order-sign example",
      description:
        "Provides decision support for an Ocean form immediately prior to submission",
      id: ORDER_SIGN_CDS_ID,
      prefetch: {
        patient: "Patient/{{context.patientId}}",
        questionnaireResponse:
          "QuestionnaireResponse?encounter={{context.encounterId}}",
        userPractitioner: "{{context.userId}}",
        userPractitionerRole:
          "PractitionerRole?practitioner={{context.userId}}",
        v11Bundle: "Bundle?_query=on-v11-add-service-request",
      },
    },
  ];

  return {
    services,
  };
}
