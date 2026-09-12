export function SkeletonCards({ count = 2 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
          <div className="mt-3 h-3 w-24 animate-pulse rounded bg-gray-100" />
          <div className="mt-4 h-3 w-full animate-pulse rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}
