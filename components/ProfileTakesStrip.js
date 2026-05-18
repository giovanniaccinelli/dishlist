"use client";

import Link from "next/link";
import { Flame } from "lucide-react";

const ACCENTS = ["#E64646", "#38BDF8", "#B76BFF", "#F59E0B", "#2BD36B"];
const ACCENT_BY_NAME = {
  red: "#E64646",
  orange: "#F26A21",
  yellow: "#D7B443",
  blue: "#5CB7E8",
  pink: "#D96EEA",
};

export default function ProfileTakesStrip({ takes = [], darkMode = true, t = (value) => value }) {
  if (!takes.length) return null;
  const hasHotTake = takes.some((take) => Number(take.questionRecentVotes || 0) > 0);
  const sortedTakes = [...takes].sort(
    (a, b) =>
      Number(b.questionTotalVotes || 0) - Number(a.questionTotalVotes || 0) ||
      Number(b.questionRecentVotes || 0) - Number(a.questionRecentVotes || 0) ||
      (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
  );

  return (
    <section className="mx-auto mb-5 w-full max-w-3xl px-2">
      <div className="mb-3 flex items-center gap-2 px-1">
        <h2 className={`text-[1.15rem] font-bold leading-none ${darkMode ? "text-white" : "text-black"}`}>{t("Takes")}</h2>
        {hasHotTake ? <Flame size={18} className="text-[#E64646]" fill="none" /> : null}
      </div>
      <div className="grid auto-cols-[calc((100%-0.75rem)/2)] grid-flow-col snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sortedTakes.slice(0, 12).map((take, index) => {
          const accent = take.accentColor || ACCENT_BY_NAME[take.questionAccent] || ACCENTS[index % ACCENTS.length];
          const questionTitle = take.questionTitle || take.question || t("Leaderboard question");
          const answer = take.text || take.answer || "";
          const hot = Number(take.questionRecentVotes || 0) > 0;
          return (
            <Link
              key={`${take.questionId || "question"}-${take.id || index}`}
              href={take.questionId ? `/leaderboard/${take.questionId}` : "/explore"}
              className={`group flex min-h-[7.4rem] w-full snap-start flex-col justify-between rounded-[1.15rem] border p-3.5 transition active:scale-[0.98] ${
                darkMode
                  ? "border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.09),rgba(255,255,255,0.035))] shadow-[0_18px_40px_rgba(0,0,0,0.28)]"
                  : "border-black/10 bg-white shadow-[0_14px_30px_rgba(0,0,0,0.10)]"
              }`}
            >
              <div>
                <span
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em]"
                  style={{ color: accent, backgroundColor: `${accent}22` }}
                >
                  {hot ? <Flame size={11} fill="currentColor" /> : null}
                  {take.questionLabel || "Best"}
                </span>
                <div className={`mt-2.5 line-clamp-3 text-[0.88rem] font-semibold leading-tight ${darkMode ? "text-white" : "text-black"}`}>
                  {questionTitle}
                </div>
                <div className="mt-2.5 h-[2px] w-12 rounded-full" style={{ backgroundColor: accent }} />
              </div>
              <div className="truncate text-[0.9rem] font-black" style={{ color: accent }}>
                {answer || t("Your answer")}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
