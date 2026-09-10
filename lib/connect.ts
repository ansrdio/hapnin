import "server-only";
import { getStripe } from "./stripe";
import { getOrganizerById, setStripeAccountId, setStripeOnboarded } from "./organizers";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "https://hapnin.now";

/**
 * Start (or resume) Stripe Connect Express onboarding for an organizer.
 * Creates an Express connected account the first time, stores its id, and
 * returns a fresh one-time onboarding link. `stripe_onboarded` is flipped later
 * by the account.updated webhook — never trusted from the redirect.
 */
export async function createOnboardingLink(organizerId: string, returnTo?: string): Promise<string> {
  const stripe = getStripe();
  const organizer = await getOrganizerById(organizerId);
  if (!organizer) throw new Error("ORGANIZER_NOT_FOUND");
  const back = returnTo ?? `/admin/organizers/${organizer.id}`;

  let accountId = organizer.stripe_account_id;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: organizer.email,
      business_profile: { name: organizer.name },
      metadata: { organizer_id: organizer.id },
      // Express account collects card payments; platform charges via destination.
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
    });
    accountId = account.id;
    await setStripeAccountId(organizer.id, accountId);
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${siteUrl()}${back}?onboarding=refresh`,
    return_url: `${siteUrl()}${back}?onboarding=done`,
  });
  return link.url;
}

/**
 * Pull the connected account's live status from Stripe and update
 * `stripe_onboarded`. Used instead of the account.updated webhook so onboarding
 * status doesn't depend on Connect webhook routing. Returns the onboarded state.
 */
export async function refreshOnboardingStatus(organizerId: string): Promise<boolean> {
  const organizer = await getOrganizerById(organizerId);
  if (!organizer?.stripe_account_id) return false;
  const account = await getStripe().accounts.retrieve(organizer.stripe_account_id);
  const ready = !!account.details_submitted && !!account.charges_enabled;
  await setStripeOnboarded(organizer.stripe_account_id, ready);
  return ready;
}

/**
 * A fresh, single-use link into the organizer's Stripe Express dashboard —
 * balance, payouts, bank details. Minted on demand because login links expire
 * within minutes. Null if the organizer hasn't connected Stripe yet.
 */
export async function createExpressLoginLink(organizerId: string): Promise<string | null> {
  const organizer = await getOrganizerById(organizerId);
  if (!organizer?.stripe_account_id) return null;
  const link = await getStripe().accounts.createLoginLink(organizer.stripe_account_id);
  return link.url;
}

export type PayoutSnapshot = {
  available_cents: number; // in the organizer's Stripe balance, payable now
  pending_cents: number; // settled sales still clearing
  last_payout: { amount_cents: number; arrival_date: number; status: string } | null;
  schedule: string; // human-readable payout schedule
};

/** "When do I get paid?" — the organizer's Stripe balance, last payout, and schedule. */
export async function getPayoutSnapshot(organizerId: string): Promise<PayoutSnapshot | null> {
  const organizer = await getOrganizerById(organizerId);
  if (!organizer?.stripe_account_id) return null;
  const stripe = getStripe();
  const acct = organizer.stripe_account_id;
  const [balance, payouts, account] = await Promise.all([
    stripe.balance.retrieve({}, { stripeAccount: acct }),
    stripe.payouts.list({ limit: 1 }, { stripeAccount: acct }),
    stripe.accounts.retrieve(acct),
  ]);
  const usd = (arr: { amount: number; currency: string }[]) =>
    arr.filter((a) => a.currency === "usd").reduce((s, a) => s + a.amount, 0);
  const p = payouts.data[0];
  const sched = account.settings?.payouts?.schedule;
  const schedule = !sched
    ? "Stripe’s standard schedule"
    : sched.interval === "manual"
      ? "manual payouts"
      : `${sched.interval}${sched.delay_days ? `, ${sched.delay_days}-day rolling` : ""}`;
  return {
    available_cents: usd(balance.available),
    pending_cents: usd(balance.pending),
    last_payout: p ? { amount_cents: p.amount, arrival_date: p.arrival_date * 1000, status: p.status } : null,
    schedule,
  };
}
