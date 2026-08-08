import "server-only";

export type PitchLead = {
  name: string;
  email: string;
  phone: string;
  instagram_handle: string | null;
  event_name: string | null;
  event_date: string | null;
  expected_attendance: number | null;
  note: string | null;
};

/**
 * Notify hook for a new pitch lead.
 *
 * Deliberately a no-op for now (chosen setup: save to Supabase only). The server
 * action already awaits this, so wiring a real alert later is a one-function job:
 *
 *   - Email: call Resend with process.env.RESEND_API_KEY + a to-address.
 *   - SMS:   call Twilio with the account SID / auth token / from-number.
 *
 * Keep it best-effort — a failing notification must never fail the insert.
 */
export async function notifyNewPitchLead(lead: PitchLead): Promise<void> {
  console.log(
    `[pitch lead] ${lead.name} <${lead.email}> ${lead.phone}` +
      (lead.event_name ? ` — ${lead.event_name}` : "") +
      (lead.event_date ? ` (${lead.event_date})` : "")
  );
}
