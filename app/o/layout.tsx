import Link from "next/link";
import { requireOrganizer } from "@/lib/auth";
import { signOutAction } from "@/app/actions/session";

// Guard: everything under /o/* requires a signed-in organizer. The real
// dashboard arrives in Phase 2; Phase 0 just proves the login + guard work.
export default async function OrganizerLayout({ children }: { children: React.ReactNode }) {
  const { organizer, role } = await requireOrganizer();
  return (
    <div className="min-h-[100svh]">
      <header className="border-b border-plum-hi px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <Link href="/o" className="font-display text-lg font-semibold text-cream">
            {organizer.name}
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/o" className="text-mauve-dim transition-colors hover:text-cream">
              Events
            </Link>
            {role === "owner" && (
              <Link href="/o/team" className="text-mauve-dim transition-colors hover:text-cream">
                Team
              </Link>
            )}
            <form action={signOutAction}>
              <button className="text-mauve-dim underline decoration-plum-hi underline-offset-4 hover:text-cream">
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-5 py-8 sm:px-8">{children}</main>
    </div>
  );
}
