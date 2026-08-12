import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { signOutAction } from "@/app/actions/session";

// Guard: everything under /admin/* requires a signed-in admin (email allowlist).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return (
    <div className="min-h-[100svh]">
      <header className="border-b border-plum-hi px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <Link href="/admin" className="font-display text-lg font-semibold text-cream">
            Hapnin <span className="text-mauve-dim">admin</span>
          </Link>
          <div className="flex items-center gap-4 text-sm text-mauve-dim">
            <span className="hidden sm:inline">{user.email}</span>
            <form action={signOutAction}>
              <button className="text-mauve-dim underline decoration-plum-hi underline-offset-4 hover:text-cream">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8">{children}</main>
    </div>
  );
}
