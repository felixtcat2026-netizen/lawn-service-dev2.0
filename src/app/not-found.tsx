import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-sm space-y-4 px-4 py-16 text-center">
      <h1 className="font-display text-2xl font-bold">We couldn&apos;t find that page</h1>
      <p className="text-[15px] text-gray-700">
        The link may be old, or the customer or job may no longer exist.
      </p>
      <Link
        href="/"
        className="flex h-12 items-center justify-center rounded-xl bg-(--color-primary) text-base font-semibold text-white"
      >
        Back to Today
      </Link>
    </main>
  );
}
