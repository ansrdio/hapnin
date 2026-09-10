import Link from "next/link";
import { unsubscribeEmailByToken } from "@/lib/buyers";
import { unsubscribeContactByToken } from "@/lib/contacts";
import { SUPPORT_EMAIL } from "@/lib/legal";

export const dynamic = "force-dynamic";

// One-click unsubscribe from marketing email (the link in every broadcast).
// Turns off email_marketing_opt_in for the buyer the token belongs to;
// transactional email (tickets, receipts, refunds) is unaffected.
export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // Tokens belong to either a buyer (checkout opt-in) or an imported contact.
  const valid = /^[A-Za-z0-9_-]{10,64}$/.test(token);
  const ok = valid ? (await unsubscribeEmailByToken(token)) || (await unsubscribeContactByToken(token)) : false;

  return (
    <main className="grain mx-auto max-w-md px-5 py-16">
      {ok ? (
        <div className="anim-rise">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Unsubscribed</p>
          <h1 className="mt-3 font-display text-3xl font-bold text-cream">No more event updates by email.</h1>
          <p className="mt-4 leading-relaxed text-mauve-dim">
            You&rsquo;ll still get the emails you need — your tickets, receipts, and refund notices. Changed your
            mind? Ticking the updates box at your next checkout turns them back on.
          </p>
        </div>
      ) : (
        <div className="anim-rise">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Hmm</p>
          <h1 className="mt-3 font-display text-3xl font-bold text-cream">That link isn&rsquo;t recognized.</h1>
          <p className="mt-4 leading-relaxed text-mauve-dim">
            It may be incomplete or from an older message. Email{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-gold hover:underline">
              {SUPPORT_EMAIL}
            </a>{" "}
            and we&rsquo;ll switch updates off for you by hand.
          </p>
        </div>
      )}
      <p className="mt-8 text-sm">
        <Link href="/" className="text-gold hover:underline">
          hapnin.now
        </Link>
      </p>
    </main>
  );
}
