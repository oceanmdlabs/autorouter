export interface OceanPatient {
  ref: string;
  siteNum: string;
  externalPatientRef: string;
  reasonForVisit: string;
  apptReason: string;
  visitType: string;
  demographics: Demographics;
  cpp: CPPList;
  results: Result[];
  ptUpdate: PtUpdate;
}

export interface CPP {
  pmhx: CPPList;
  prob: CPPList;
  fhx: CPPList;
  allg: CPPList;
  tx: CPPList;
  rx: CPPList;
  immu: CPPList;
  soc: CPPList;
}

export interface CPPList {
  items: CPPItem[];
}

export interface CPPItem {
  key: string;
  desc: string;
  data: Map<string, string>;
}

export interface PtUpdate {
  progressNote: ProgressNote;
  completedForms: Map<string, Map<string, string>>;
  emrFieldUpdates: Map<string, string>;
  formMetadata: Map<string, Map<string, FormItemMetadata>>;
}

export interface PatientNote {
  noteId: string;
  emrPtId: string;
  ptUpdate: PtUpdate;
}

export interface FormItemMetadata {
  hidden: boolean;
}

export interface ProgressNote {
  title: string;
  text: string;
  noteType: string;
}
export interface EncryptedBlockDto {
  data: string; //base64
  iv: string; //base64
}

export interface Result {
  key: string;
  val: string;
  date: string;
}

export interface Demographics {
  firstName: string;
  surname: string;
  preferredName: string;
  secondName: string;
  title: string;
  suffix: string;
  hn: string;
  hnProv: string;
  hnVC: string;
  hnExpiryDate: string;
  alternateId: string;
  maidenName: string;
  //must be a string of format yyyy-mm-dd to be JSON-compatible:
  birthDate: string;
  approxAgeInDays: number;
  sex: string;
  address: Address;
  address2: Address;
  preferredPharmacy: Address;
  emergencyContact: string;
  emergencyContactPhone: string;
  language: string;
  memberStatus: string;
  diagnosis: string;
  emailConsent: string;
  familyDoc: Clinician;
  clinicDoc: Clinician;
  comments: string;
  customFields: Map<string, string>;
}

export interface Clinician {
  name: string;
  signature: string;
  billingNum: string;
  professionalId: string;
}

export interface Address {
  line1: string;
  line2: string;
  city: string;
  province: string;
  country: string;
  postalCode: string;
  phone: string;
  fax: string;
  email: string;
  website: string;
}
