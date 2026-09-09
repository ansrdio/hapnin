import type { Metadata } from "next";
import { LegalPage } from "@/app/components/LegalPage";
import { LEGAL_NAME, SUPPORT_EMAIL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy — Hapnin",
  description: "What Hapnin collects, why, who it's shared with, and your choices.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy Policy"
      title="What we know, and what we do with it."
      intro={`This is how ${LEGAL_NAME} handles your information when you buy tickets, host events, or otherwise use hapnin.now. Short version: we collect what it takes to get you into the event and pay the organizer, we don't sell it, and you can ask us to delete it.`}
    >
      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>When you buy a ticket:</strong> your name, mobile number, email, ZIP code, the tickets you
          bought, and your answers to optional questions (like whether you&rsquo;re into film screenings).
        </li>
        <li>
          <strong>When you consent to texts:</strong> the exact consent wording you agreed to, the time, and your
          IP address and browser — we keep this as proof of consent.
        </li>
        <li>
          <strong>When you host events:</strong> your name, handle, email, phone, Instagram if you give it, your
          event details and flyers, and your Stripe account ID (Stripe holds your identity and bank details, not us).
        </li>
        <li>
          <strong>Payments:</strong> handled entirely by Stripe. We receive a payment reference, the amount, and the
          card&rsquo;s last four digits and brand — never the full card number.
        </li>
        <li>
          <strong>Automatically:</strong> standard server logs (IP address, browser, pages requested) and a
          sign-in cookie that keeps you logged in for 14 days. We don&rsquo;t use advertising trackers.
        </li>
      </ul>

      <h2>Why we use it</h2>
      <ul>
        <li>To deliver your ticket, admit you at the door, and send receipts and refund notices.</li>
        <li>To pay the organizer and to detect and prevent fraud and duplicate tickets.</li>
        <li>
          To send you event updates from the organizers you bought from, and news about Hapnin and African
          events near you — <strong>only if you opted in</strong>, and you can stop any time.
        </li>
        <li>To answer support requests and to understand how the service is used so we can improve it.</li>
      </ul>

      <h2>Who we share it with</h2>
      <ul>
        <li>
          <strong>The organizer of an event you buy into</strong> sees your name, phone, email, and ticket status —
          they need it to run the door and to contact you about that event. They may only use it for that event
          and for messages you opted into.
        </li>
        <li>
          <strong>Service providers</strong> that run Hapnin, each only for their job: Stripe (payments and organizer
          payouts), Brevo (email), Twilio (text messages), Google Firebase / Google Cloud (database, sign-in, and
          file storage), and Vercel (hosting).
        </li>
        <li>
          <strong>When the law requires it</strong> — a valid legal request, or to protect the safety of people at an
          event.
        </li>
      </ul>
      <p>We do not sell your personal information, and we don&rsquo;t share it with advertisers.</p>

      <h2>Text messages</h2>
      <p>
        Texts are sent only with your consent. Reply <strong>STOP</strong> to opt out of marketing texts, or{" "}
        <strong>HELP</strong> for help. Message frequency varies; message and data rates may apply. Transactional
        texts (your ticket link, refund notices) are part of the service you asked for.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Purchase and ticket records are kept for as long as needed for refunds, chargebacks, accounting, and
        fraud prevention. Consent records are kept as long as you&rsquo;re opted in, plus the period required to
        prove consent. Marketing preferences are kept until you change them. Ask us to delete your data and we
        will, except what we must keep for legal or payment reasons.
      </p>

      <h2>Security</h2>
      <p>
        Data is encrypted in transit and stored with reputable cloud providers with access controls. No system is
        perfectly secure; if we ever discover a breach affecting you, we&rsquo;ll tell you.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>Stop marketing texts by replying STOP; stop marketing emails with the unsubscribe link.</li>
        <li>
          Ask to see, correct, or delete your information by emailing {SUPPORT_EMAIL}. We&rsquo;ll verify it&rsquo;s you
          and respond within 30 days.
        </li>
        <li>Residents of states with privacy laws (for example California) have these rights in law; we honor them for everyone.</li>
      </ul>

      <h2>Children</h2>
      <p>
        Hapnin is not directed to children under 13 and we don&rsquo;t knowingly collect their information. Many
        events are 18+ or 21+; the organizer sets and enforces age rules.
      </p>

      <h2>Changes</h2>
      <p>
        We&rsquo;ll update this policy as Hapnin grows and post the date of the latest version at the top. If a
        change materially affects how we use your data, we&rsquo;ll tell you before it takes effect.
      </p>

      <h2>Contact</h2>
      <p>
        {LEGAL_NAME} · Phoenix, Arizona · {SUPPORT_EMAIL}
      </p>
    </LegalPage>
  );
}
