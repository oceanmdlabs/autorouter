/**
 * Normalizes a phone number to E.164 format (+1XXXXXXXXXX) for Canadian numbers.
 * Returns null if the input cannot be recognized as a 10- or 11-digit North American number.
 */
export function normalizePhoneNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  return null;
}

// Canadian area codes (E.164: +1 followed by one of these 3-digit area codes)
const CANADIAN_AREA_CODES = new Set([
  "403", "587", "780", "825",             // Alberta
  "236", "250", "604", "672", "778",      // British Columbia
  "204", "431",                            // Manitoba
  "506",                                   // New Brunswick
  "709", "879",                            // Newfoundland & Labrador
  "867",                                   // NT / NU / YT
  "782", "902",                            // Nova Scotia / PEI
  "226", "249", "289", "343", "365", "382", "416", "437", "519", "548", "613", "647", "705", "807", "905", // Ontario
  "367", "418", "438", "450", "514", "579", "581", "819", "873",  // Quebec
  "306", "474", "639",                     // Saskatchewan
]);

export function isCanadianPhoneNumber(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return CANADIAN_AREA_CODES.has(digits.slice(1, 4));
  }
  if (digits.length === 10) {
    return CANADIAN_AREA_CODES.has(digits.slice(0, 3));
  }
  return false;
}
