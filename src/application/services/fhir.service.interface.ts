import type { OperationOutcomeIssue, Resource } from "fhir/r4";

export type MakeOptional<T, K extends keyof T> = Omit<T, K> &
  Partial<Pick<T, K>>;

export interface IFhirService {
  validateResource: (resource: Resource) => Promise<ValidationResponse>;
}

export type ValidationResponse = {
  valid: boolean;
  issues: OperationOutcomeIssue[];
  description: string;
};
