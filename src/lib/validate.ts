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

/** Official ABN check: 11 digits whose weighted sum (first digit minus 1) is divisible by 89. */
export function isValidAbn(abn: string): boolean {
  const d = abn.replace(/\s/g, "");
  if (!/^\d{11}$/.test(d)) return false;
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const digits = d.split("").map(Number);
  digits[0] -= 1;
  return digits.reduce((sum, n, i) => sum + n * weights[i], 0) % 89 === 0;
}

export function formatAbn(abn: string): string {
  const d = abn.replace(/\s/g, "");
  return /^\d{11}$/.test(d) ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{3})/, "$1 $2 $3 $4") : abn.trim();
}
