export default function Loading() {
  return (
    <div className="space-y-4" role="status" aria-live="polite">
      <span className="sr-only">Loading...</span>
      <div className="space-y-2 motion-safe:animate-pulse">
        <div className="h-8 w-32 rounded-lg bg-gray-200" />
        <div className="h-4 w-40 rounded bg-gray-200" />
      </div>
      <div className="h-36 rounded-3xl bg-gray-200 motion-safe:animate-pulse" />
      <div className="h-56 rounded-3xl bg-gray-200 motion-safe:animate-pulse" />
      <div className="h-16 rounded-2xl bg-gray-200 motion-safe:animate-pulse" />
    </div>
  );
}
