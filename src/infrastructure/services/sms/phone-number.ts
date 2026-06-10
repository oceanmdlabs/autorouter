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
