import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/domain/money";
import { getCurrentOrganization } from "@/lib/supabase/org";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; inactive?: string }>;
}) {
  const { q = "", inactive } = await searchParams;
  const supabase = await createClient();
  const org = await getCurrentOrganization(supabase);

  let query = supabase
    .from("customers")
    .select("id, first_name, last_name, phone, city, state, default_price_cents, is_active")
    .eq("is_active", inactive === "1" ? false : true)
    .order("last_name", { ascending: true });

  if (q.trim()) {
    const term = q.trim();
    query = query.or(
      `first_name.ilike.%${term}%,last_name.ilike.%${term}%,phone.ilike.%${term}%`,
    );
  }

  const { data: customers } = await query;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Customers</h1>
        <Link
          href="/customers/new"
          className="rounded-lg bg-(--color-primary) px-4 py-2 text-sm font-semibold text-white"
        >
          Add Customer
        </Link>
      </div>

      <form className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by name or phone"
          className="flex-1 rounded-lg border border-(--color-border) px-3 py-2 text-base"
        />
        {inactive === "1" && <input type="hidden" name="inactive" value="1" />}
        <button
          type="submit"
          className="rounded-lg border border-(--color-border) px-3 py-2 text-sm"
        >
          Search
        </button>
      </form>

      <div className="flex gap-2 text-sm">
        <Link
          href={q ? `/customers?q=${encodeURIComponent(q)}` : "/customers"}
          className={inactive !== "1" ? "font-semibold underline" : "text-gray-500"}
        >
          Active
        </Link>
        <Link
          href={`/customers?inactive=1${q ? `&q=${encodeURIComponent(q)}` : ""}`}
          className={inactive === "1" ? "font-semibold underline" : "text-gray-500"}
        >
          Inactive
        </Link>
      </div>

      <div className="space-y-2">
        {(customers ?? []).length === 0 && (
          <p className="text-sm text-gray-500">No customers found.</p>
        )}
        {(customers ?? []).map((c) => (
          <Link
            key={c.id}
            href={`/customers/${c.id}`}
            className="block rounded-xl border border-(--color-border) bg-(--color-surface) p-4"
          >
            <p className="font-semibold">
              {c.first_name} {c.last_name}
            </p>
            <p className="text-sm text-gray-600">
              {c.phone} &middot; {c.city}, {c.state}
            </p>
            <p className="text-sm text-gray-500">
              Default price: {formatCents(c.default_price_cents, org.currency)}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
