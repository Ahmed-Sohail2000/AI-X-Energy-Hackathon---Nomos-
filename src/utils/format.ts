const digitWords: Record<string, string> = {
  "0": "null",
  "1": "eins",
  "2": "zwei",
  "3": "drei",
  "4": "vier",
  "5": "fuenf",
  "6": "sechs",
  "7": "sieben",
  "8": "acht",
  "9": "neun"
};

export function readDigitsDe(value: string): string {
  return value
    .replace(/\s+/g, "")
    .split("")
    .map((char) => digitWords[char] ?? char.toUpperCase())
    .join(", ");
}

export function normalizePhoneNumber(value: string): string {
  return value.trim().replace(/[^\d+]/g, "");
}

export function isPracticeNumber(target: string, practiceNumber: string | undefined): boolean {
  if (!practiceNumber) {
    return false;
  }
  return normalizePhoneNumber(target) === normalizePhoneNumber(practiceNumber);
}
