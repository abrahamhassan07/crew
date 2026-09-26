export const AU_STATES = ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"] as const;

export function isValidAuMobile(phone: string): boolean {
  return /^04\d{8}$/.test(phone.replace(/\s/g, ""));
}

export function isValidAuPostcode(postcode: string): boolean {
  return /^\d{4}$/.test(postcode);
}

export function isValidEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

export function formatAuPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (/^04\d{8}$/.test(digits)) return digits.replace(/(\d{4})(\d{3})(\d{3})/, "$1 $2 $3");
  if (/^0[2378]\d{8}$/.test(digits)) return digits.replace(/(\d{2})(\d{4})(\d{4})/, "$1 $2 $3");
  return phone;
}
