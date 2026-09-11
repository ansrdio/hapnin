import "server-only";

// Launch codes: an organizer who signs up with one gets Hapnin's platform fee
// waived for N days (organizers.fee_waived_until). Codes live in the
// LAUNCH_CODES env var so they never sit in the repo:
//   LAUNCH_CODES="PHXLAUNCH:90,FRIEND:30"
// Matching is case-insensitive. No env var → no codes accepted.

export type LaunchOffer = { code: string; days: number };

export function parseLaunchCodes(raw = process.env.LAUNCH_CODES ?? ""): LaunchOffer[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [code, days] = s.split(":");
      const n = parseInt(days ?? "", 10);
      return { code: (code ?? "").trim().toUpperCase(), days: Number.isFinite(n) && n > 0 ? n : 0 };
    })
    .filter((o) => o.code && o.days > 0);
}

export function resolveLaunchCode(input: string | null | undefined): LaunchOffer | null {
  const code = (input ?? "").trim().toUpperCase();
  if (!code) return null;
  return parseLaunchCodes().find((o) => o.code === code) ?? null;
}
