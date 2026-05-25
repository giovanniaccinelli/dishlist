"use client";

import { DiningModeOpeningSelection } from "./DishModeControls";

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

export function FeedLoading({ onModeSelect }) {
  return (
    <div className="h-[100dvh] bg-[#050505] px-4 text-black">
      <div className="app-top-nav pb-2" />
      <div className="flex h-[78vh] flex-col items-center justify-center px-4 pt-16">
        <DiningModeOpeningSelection onSelect={onModeSelect} intro />
      </div>
    </div>
  );
}

export function PeopleGridLoading({ searching = false }) {
  return (
    <div>
      {searching ? <div className="mb-3 text-sm font-medium text-black/45">Searching people...</div> : null}
      <div className="flex flex-col gap-3">
        {Array.from({ length: searching ? 4 : 6 }).map((_, idx) => (
          <div key={idx} className="flex items-center gap-3 rounded-[1.35rem] border border-black/6 bg-white/82 p-3 shadow-[0_12px_30px_rgba(0,0,0,0.05)]">
            <PulseBlock className="h-14 w-14 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <PulseBlock className="mb-2 h-4 w-32 rounded-full" />
              <div className="flex gap-1.5">
                <PulseBlock className="h-5 w-14 rounded-full" />
                <PulseBlock className="h-5 w-16 rounded-full" />
                <PulseBlock className="h-5 w-12 rounded-full" />
              </div>
            </div>
            <PulseBlock className="h-9 w-20 shrink-0 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PeopleInlineLoading() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 2 }).map((_, idx) => (
        <div key={idx} className="flex items-center gap-3 rounded-[1.35rem] border border-black/6 bg-white/82 p-3 shadow-[0_12px_30px_rgba(0,0,0,0.05)]">
          <PulseBlock className="h-14 w-14 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <PulseBlock className="mb-2 h-4 w-32 rounded-full" />
            <div className="flex gap-1.5">
              <PulseBlock className="h-5 w-14 rounded-full" />
              <PulseBlock className="h-5 w-16 rounded-full" />
              <PulseBlock className="h-5 w-12 rounded-full" />
            </div>
          </div>
          <PulseBlock className="h-9 w-20 shrink-0 rounded-full" />
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
