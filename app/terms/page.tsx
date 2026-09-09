import type { Metadata } from "next";
import { LegalPage } from "@/app/components/LegalPage";
import { LEGAL_NAME, SUPPORT_EMAIL, GOVERNING_STATE, PLATFORM_FEE_TEXT } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service — Hapnin",
  description: "The terms for buying tickets and hosting events on Hapnin.",
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Terms of Service"
      title="The deal, in plain language."
      intro={`These terms cover everyone who uses Hapnin — people buying tickets and organizers hosting events. By using hapnin.now you agree to them. Hapnin is operated by ${LEGAL_NAME}.`}
    >
      <h2>What Hapnin is</h2>
      <p>
        Hapnin is a ticketing and promotion platform. <strong>Organizers</strong> list their events and sell
        tickets through it; <strong>buyers</strong> purchase tickets and get in with a QR code. Hapnin is not the
        organizer, promoter, or venue of any event. The organizer is responsible for the event itself — what
        happens there, whether it goes ahead, entry rules, and age limits.
      </p>

      <h2>Accounts and sign-in</h2>
      <p>
        We sign you in with a one-time link sent to your email; there are no passwords. Keep your email account
        secure — anyone who can open your email can open your Hapnin account. Organizers who add team members
        (managers or door staff) are responsible for what those people do in their account.
      </p>

      <h2>Buying tickets</h2>
      <ul>
        <li>
          The price you see at checkout is the price you pay: the ticket&rsquo;s face value plus a card-processing
          charge that is shown before you pay. There are no hidden fees.
        </li>
        <li>
          Your ticket is a link with a QR code, delivered to the email address (and, when texting is available,
          the phone number) you enter. Enter them carefully — we deliver to what you type.
        </li>
        <li>
          One QR code admits one person once. Tickets can be sent to someone else only through the
          &ldquo;Send a ticket&rdquo; feature on your ticket page. Screenshots of a code that has already been
          scanned will be refused at the door.
        </li>
        <li>
          Organizers set entry rules — age limits, ID checks, dress codes, bag policies. Being refused entry for
          not meeting the organizer&rsquo;s rules is not grounds for a refund from Hapnin.
        </li>
      </ul>

      <h2>Refunds, cancellations, and changes</h2>
      <ul>
        <li>
          Every event page shows the organizer&rsquo;s <strong>refund policy</strong> before you buy. Refund decisions
          within that policy are made by the organizer, and refunds are issued through Hapnin to the card you paid
          with, normally within 5–10 business days of being issued.
        </li>
        <li>
          If an organizer <strong>cancels</strong> an event, ticket holders are refunded the amount they paid.
        </li>
        <li>
          If an event is materially changed (date, venue, headliner), the organizer decides whether to offer
          refunds. Ask them first, then us at {SUPPORT_EMAIL} if you can&rsquo;t reach them.
        </li>
        <li>
          Please contact us before disputing a charge with your bank — we can usually resolve it faster, and
          unwarranted chargebacks may lead to account restrictions.
        </li>
      </ul>

      <h2>Payments and organizer payouts</h2>
      <p>
        Payments are processed by <strong>Stripe</strong>. Hapnin never sees or stores full card numbers. Organizers
        are paid out through their own Stripe account, which they connect and verify themselves; Hapnin does not
        hold organizer funds. Hapnin&rsquo;s platform fee — currently {PLATFORM_FEE_TEXT} — is deducted from each
        sale before payout. Organizers are responsible for their own taxes on ticket revenue.
      </p>

      <h2>If you host events</h2>
      <ul>
        <li>List accurately: real dates, venues, lineups, and ticket details. Honor every valid ticket you sell.</li>
        <li>Set a refund policy you will actually follow, and refund promptly when your policy or the law requires it.</li>
        <li>Comply with venue, licensing, age, capacity, and safety laws. You are the one running the event.</li>
        <li>Complete Stripe&rsquo;s identity and bank verification yourself and keep it current.</li>
        <li>
          Only message buyers who opted in, only about the events they bought into or Hapnin, and stop when they
          ask. Marketing texts must follow the law in your buyers&rsquo; location.
        </li>
        <li>
          Hapnin may pause or remove listings, delay payouts, or close accounts for fraud, chargebacks, illegal
          events, or breaches of these terms.
        </li>
      </ul>

      <h2>Texts and emails</h2>
      <p>
        By checking the consent box at checkout you agree to receive texts and emails from Hapnin and from the
        organizers of events you attend. Reply <strong>STOP</strong> to any text to opt out; message and data rates
        may apply. Transactional messages (your ticket, receipts, refund notices) are sent regardless of marketing
        preferences.
      </p>

      <h2>What you may not do</h2>
      <ul>
        <li>Resell tickets at inflated prices, forge or duplicate QR codes, or list events you don&rsquo;t control.</li>
        <li>Scrape, attack, overload, or reverse-engineer the service, or use it to send spam.</li>
        <li>Use Hapnin for anything unlawful, or to discriminate against attendees in ways the law prohibits.</li>
      </ul>

      <h2>Content and ownership</h2>
      <p>
        Organizers keep the rights to their flyers, names, and descriptions, and give Hapnin permission to display
        and promote them on the platform. Hapnin&rsquo;s name, design, and software are ours.
      </p>

      <h2>Disclaimers and limits</h2>
      <p>
        Hapnin is provided <strong>as is</strong>. We work hard to keep it reliable, but we don&rsquo;t promise it will be
        uninterrupted or error-free, and we are not responsible for events themselves — their quality, safety,
        occurrence, or the conduct of organizers, venues, or attendees. To the fullest extent the law allows,
        Hapnin&rsquo;s total liability to you for anything arising from the service is limited to the greater of the
        Hapnin platform fees paid on your transactions in the previous twelve months or $100. Organizers agree to
        cover Hapnin for claims arising from their events or their breach of these terms.
      </p>

      <h2>Law and disputes</h2>
      <p>
        These terms are governed by the laws of the State of {GOVERNING_STATE}, USA. Talk to us first at{" "}
        {SUPPORT_EMAIL} — most problems are solved in a message or two.
      </p>

      <h2>Changes</h2>
      <p>
        We&rsquo;ll update these terms as Hapnin grows and will post the date of the latest version at the top.
        Continuing to use Hapnin after a change means you accept it.
      </p>
    </LegalPage>
  );
}
