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
export async function createOnboardingLink(organizerId: string): Promise<string> {
  const stripe = getStripe();
  const organizer = await getOrganizerById(organizerId);
  if (!organizer) throw new Error("ORGANIZER_NOT_FOUND");

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
    refresh_url: `${siteUrl()}/admin/organizers/${organizer.id}?onboarding=refresh`,
    return_url: `${siteUrl()}/admin/organizers/${organizer.id}?onboarding=done`,
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
