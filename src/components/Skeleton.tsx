import { useEffect, useRef } from 'react';
import { shimmer } from '@/lib/anim';

export function Skeleton({ className = '' }: { className?: string }) {
  const hl = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!hl.current) return;
    const tween = shimmer(hl.current);
    return () => {
      tween.kill();
    };
  }, []);
  return (
    <span className={`relative block overflow-hidden rounded-md bg-gray-200 ${className}`}>
      <span
        ref={hl}
        className="absolute inset-0 block bg-gradient-to-r from-transparent via-white/70 to-transparent"
      />
    </span>
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="mt-3 flex gap-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="mt-3 flex gap-2">
        <Skeleton className="h-7 w-20 rounded-lg" />
        <Skeleton className="h-7 w-20 rounded-lg" />
      </div>
    </div>
  );
}

export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonOrderCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm ring-1 ring-black/[0.02]">
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 px-4 pb-3.5 pt-3">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-16" />
        </div>
        <div className="mt-3 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <Skeleton className="h-5 w-12" />
            <Skeleton className="mt-1 h-4 w-20" />
          </div>
          <div className="flex min-w-[76px] flex-col items-center gap-1.5 pt-0.5">
            <Skeleton className="h-2.5 w-14" />
            <Skeleton className="h-0.5 w-full" />
            <Skeleton className="h-2.5 w-10" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-end">
            <Skeleton className="h-5 w-12" />
            <Skeleton className="mt-1 h-4 w-20" />
          </div>
        </div>
      </div>
      <div className="border-t border-dashed border-gray-200" />
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <div className="min-w-0">
          <Skeleton className="h-5 w-28" />
          <div className="mt-1 flex gap-1">
            <Skeleton className="h-6 w-16 rounded-md" />
            <Skeleton className="h-6 w-14 rounded-md" />
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-6 w-10 rounded-md" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonOrderCards({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonOrderCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-1">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-2.5 rounded-lg border border-gray-200 bg-white px-3 py-2"
        >
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="ml-auto h-3 w-10" />
        </div>
      ))}
    </div>
  );
}
