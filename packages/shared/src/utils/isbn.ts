/** Strip hyphens/spaces and uppercase a trailing x. */
export function normalizeIsbn(raw: string): string {
  return raw.replace(/[^0-9Xx]/g, "").toUpperCase();
}

export function isValidIsbn10(raw: string): boolean {
  const isbn = normalizeIsbn(raw);
  if (!/^[0-9]{9}[0-9X]$/.test(isbn)) return false;
  const sum = [...isbn].reduce((acc, ch, i) => acc + (ch === "X" ? 10 : Number(ch)) * (10 - i), 0);
  return sum % 11 === 0;
}

export function isValidIsbn13(raw: string): boolean {
  const isbn = normalizeIsbn(raw);
  if (!/^[0-9]{13}$/.test(isbn)) return false;
  const sum = [...isbn].reduce((acc, ch, i) => acc + Number(ch) * (i % 2 === 0 ? 1 : 3), 0);
  return sum % 10 === 0;
}

/** Convert ISBN-10 to ISBN-13 (978 prefix). Returns null if invalid. */
export function isbn10To13(raw: string): string | null {
  const isbn = normalizeIsbn(raw);
  if (!isValidIsbn10(isbn)) return null;
  const base = "978" + isbn.slice(0, 9);
  const sum = [...base].reduce((acc, ch, i) => acc + Number(ch) * (i % 2 === 0 ? 1 : 3), 0);
  return base + ((10 - (sum % 10)) % 10);
}
