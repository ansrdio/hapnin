// Shared validation + normalization for both signup forms.
// Kept dependency-free so it runs identically on server and (for hints) client.

export type FieldErrors = Record<string, string>;

/**
 * Normalize a US phone number to E.164 (+1XXXXXXXXXX).
 * Accepts common human formats: (602) 555-0142, 602-555-0142, 6025550142,
 * 1 602 555 0142, +1 602 555 0142.
 * Returns null if it cannot be a valid US number.
 */
export function normalizeUsPhone(input: string): string | null {
  const digits = (input || "").replace(/[^\d]/g, "");
  let national = digits;
  if (national.length === 11 && national.startsWith("1")) {
    national = national.slice(1);
  }
  if (national.length !== 10) return null;
  // NANP: area code and exchange code cannot start with 0 or 1.
  if (/^[01]/.test(national)) return null;
  if (/^.{3}[01]/.test(national)) return null;
  return `+1${national}`;
}

/** US ZIP: exactly 5 digits (ZIP+4 trimmed to the 5-digit prefix). */
export function normalizeZip(input: string): string | null {
  const m = (input || "").trim().match(/^(\d{5})(?:-\d{4})?$/);
  return m ? m[1] : null;
}

/** Pragmatic email check — good enough for a signup, not a spec parser. */
export function normalizeEmail(input: string): string | null {
  const v = (input || "").trim().toLowerCase();
  if (v.length < 5 || v.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return null;
  return v;
}

/** Instagram handle, optional. Strips a leading @ and validates the charset. */
export function normalizeInstagram(input: string): string | null | undefined {
  const raw = (input || "").trim().replace(/^@+/, "");
  if (!raw) return undefined; // optional → omit
  if (!/^[A-Za-z0-9._]{1,30}$/.test(raw)) return null; // present but invalid
  return raw;
}

export function cleanText(input: string, max = 120): string {
  return (input || "").trim().slice(0, max);
}

/** Accepts an <input type="date"> value (YYYY-MM-DD). Empty → undefined (optional). */
export function normalizeDate(input: string): string | null | undefined {
  const v = (input || "").trim();
  if (!v) return undefined; // optional → omit
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return v;
}

/** Parse an expected-attendance count. Empty → undefined; out of range → null. */
export function parseAttendance(input: string): number | null | undefined {
  const v = (input || "").trim();
  if (!v) return undefined;
  if (!/^\d{1,7}$/.test(v)) return null;
  const n = parseInt(v, 10);
  if (n < 1 || n > 1_000_000) return null;
  return n;
}
