"use client";

function PulseBlock({ className = "" }) {
  return <div className={`animate-pulse rounded-[1rem] bg-black/[0.06] ${className}`} />;
}

export function FullScreenLoading({ title = "Loading" }) {
  return (
    <div className="min-h-screen bg-transparent px-4 pt-10 text-black">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 flex items-center justify-between">
          <PulseBlock className="h-11 w-24 rounded-[1.1rem]" />
          <PulseBlock className="h-11 w-11 rounded-[1rem]" />
        </div>
        <div className="mb-3 text-sm font-medium text-black/45">{title}...</div>
        <div className="space-y-4">
          <PulseBlock className="h-5 w-36 rounded-full" />
          <PulseBlock className="h-48 w-full rounded-[2rem]" />
          <PulseBlock className="h-20 w-full rounded-[1.5rem]" />
        </div>
      </div>
    </div>
  );
}

export function FeedLoading() {
  return (
    <div className="h-[100dvh] bg-transparent px-4 text-black">
      <div className="app-top-nav pb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PulseBlock className="h-8 w-8 rounded-full" />
          <PulseBlock className="h-7 w-36 rounded-full" />
        </div>
        <div className="flex gap-2">
          <PulseBlock className="h-10 w-10 rounded-[0.95rem]" />
          <PulseBlock className="h-10 w-10 rounded-[0.95rem]" />
          <PulseBlock className="h-10 w-10 rounded-[0.95rem]" />
        </div>
      </div>
      <div className="grid grid-cols-[48px_1fr_48px] items-end gap-3">
        <PulseBlock className="h-11 w-11 rounded-full" />
        <div className="flex justify-center">
          <PulseBlock className="h-7 w-40 rounded-full" />
        </div>
        <PulseBlock className="h-11 w-11 rounded-full" />
      </div>
      <div className="flex h-[68vh] items-center justify-center pt-3">
        <div className="animate-pulse">
          <img
            src="/logo-real.png"
            alt="DishList"
            className="h-44 w-44 object-contain drop-shadow-[0_18px_38px_rgba(240,166,35,0.22)]"
          />
        </div>
      </div>
    </div>
  );
}

export function PeopleGridLoading({ searching = false }) {
  return (
    <div>
      {searching ? <div className="mb-3 text-sm font-medium text-black/45">Searching people...</div> : null}
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: searching ? 4 : 6 }).map((_, idx) => (
          <div key={idx} className="overflow-hidden rounded-2xl border border-black/6 bg-white/82 p-3 shadow-[0_12px_30px_rgba(0,0,0,0.05)]">
            <div className="mb-3 flex items-start gap-3">
              <PulseBlock className="h-10 w-10 rounded-full" />
              <div className="min-w-0 flex-1 pt-1">
                <PulseBlock className="mb-2 h-3.5 w-24 rounded-full" />
              </div>
            </div>
            <div className="mb-3 grid grid-cols-2 gap-2">
              {Array.from({ length: 4 }).map((_, imageIdx) => (
                <PulseBlock key={imageIdx} className="aspect-square rounded-lg" />
              ))}
            </div>
            <div className="flex justify-end">
              <PulseBlock className="h-8 w-20 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PeopleInlineLoading() {
  return (
    <div className="grid grid-cols-2 gap-4">
      {Array.from({ length: 2 }).map((_, idx) => (
        <div key={idx} className="overflow-hidden rounded-2xl border border-black/6 bg-white/82 p-3 shadow-[0_12px_30px_rgba(0,0,0,0.05)]">
          <div className="mb-3 flex items-start gap-3">
            <PulseBlock className="h-10 w-10 rounded-full" />
            <div className="min-w-0 flex-1 pt-1">
              <PulseBlock className="mb-2 h-3.5 w-24 rounded-full" />
            </div>
          </div>
          <div className="mb-3 grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }).map((_, imageIdx) => (
              <PulseBlock key={imageIdx} className="aspect-square rounded-lg" />
            ))}
          </div>
          <div className="flex justify-end">
            <PulseBlock className="h-8 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CategoryRowsLoading() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div key={idx}>
          <div className="mb-2.5 flex items-center justify-between">
            <PulseBlock className="h-5 w-28 rounded-full" />
            <PulseBlock className="h-10 w-10 rounded-[1rem]" />
          </div>
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 3 }).map((_, cardIdx) => (
              <PulseBlock key={cardIdx} className="h-28 min-w-[31.5%] rounded-2xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DishGridLoading({ label = "Loading dishes" }) {
  return (
    <div>
      <div className="mb-3 text-sm font-medium text-black/45">{label}...</div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, idx) => (
          <PulseBlock key={idx} className="h-40 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export function DishInlineLoading() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 2 }).map((_, idx) => (
        <PulseBlock key={idx} className="h-40 rounded-2xl" />
      ))}
    </div>
  );
}

export function ListLoading() {
  return (
    <div className="grid grid-cols-1 gap-3">
      {Array.from({ length: 5 }).map((_, idx) => (
        <div key={idx} className="flex items-center gap-3 rounded-2xl border border-black/6 bg-white/85 p-4 shadow-[0_10px_24px_rgba(0,0,0,0.05)]">
          <PulseBlock className="h-11 w-11 rounded-full" />
          <div className="min-w-0 flex-1">
            <PulseBlock className="mb-2 h-4 w-28 rounded-full" />
            <PulseBlock className="h-3 w-40 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
