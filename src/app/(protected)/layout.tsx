import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";

export default async function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  // getUser() re-verifies the token with Supabase Auth rather than trusting
  // a locally-readable cookie, per the current server-side auth guidance.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col pb-20">
      <header className="flex items-center justify-between border-b border-(--color-border) bg-(--color-surface) px-4 py-3">
        <span className="text-lg font-semibold">Lawn Service</span>
        <form action={signOut}>
          <button type="submit" className="text-sm text-gray-600 underline">
            Sign out
          </button>
        </form>
      </header>

      <main className="flex-1 px-4 py-4">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 flex border-t border-(--color-border) bg-(--color-surface)">
        <NavLink href="/" label="Today" />
        <NavLink href="/customers" label="Customers" />
        <NavLink href="/schedule" label="Schedule" />
      </nav>
    </div>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex-1 py-4 text-center text-base font-medium text-(--color-text)"
    >
      {label}
    </Link>
  );
}
