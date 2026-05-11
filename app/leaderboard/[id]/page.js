"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Flame, Lock, MessageCircle, MoreHorizontal, Share } from "lucide-react";
import { useAuth } from "../../lib/auth";
import {
  addLeaderboardAnswer,
  getLeaderboardAnswers,
  getLeaderboardQuestion,
  getLeaderboardQuestions,
  voteLeaderboardAnswer,
} from "../../lib/firebaseHelpers";
import { useLanguage } from "../../../components/LanguageProvider";

const accentMap = {
  red: { main: "#E64646", soft: "rgba(230,70,70,0.16)", glow: "rgba(230,70,70,0.25)" },
  orange: { main: "#F26A21", soft: "rgba(242,106,33,0.16)", glow: "rgba(242,106,33,0.22)" },
  yellow: { main: "#D7B443", soft: "rgba(215,180,67,0.16)", glow: "rgba(215,180,67,0.20)" },
  blue: { main: "#5CB7E8", soft: "rgba(92,183,232,0.16)", glow: "rgba(92,183,232,0.20)" },
  pink: { main: "#D96EEA", soft: "rgba(217,110,234,0.16)", glow: "rgba(217,110,234,0.20)" },
};

function voteCount(answer) {
  return Array.isArray(answer?.votes) ? answer.votes.length : 0;
}

function PodiumIcon({ className = "h-6 w-6" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M4 11.25H8.35V20H4V11.25Z" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round" />
      <path d="M9.85 4H14.15V20H9.85V4Z" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round" />
      <path d="M15.65 8.25H20V20H15.65V8.25Z" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round" />
      <path d="M3 20H21" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
    </svg>
  );
}

export default function LeaderboardQuestionPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const questionId = params?.id;
  const [questions, setQuestions] = useState([]);
  const [question, setQuestion] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [answerText, setAnswerText] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const swipeRef = useRef(null);

  const accent = accentMap[question?.accent] || accentMap.red;
  const rankedAnswers = useMemo(
    () => [...answers].sort((a, b) => voteCount(b) - voteCount(a) || (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)),
    [answers]
  );
  const totalVotes = rankedAnswers.reduce((sum, answer) => sum + voteCount(answer), 0);
  const currentIndex = Math.max(0, questions.findIndex((item) => item.id === questionId));
  const hot = Number(question?.recentVotes || 0) > 0;

  const load = async () => {
    if (!questionId) return;
    setLoading(true);
    const [allQuestions, nextQuestion, nextAnswers] = await Promise.all([
      getLeaderboardQuestions(40),
      getLeaderboardQuestion(questionId),
      getLeaderboardAnswers(questionId),
    ]);
    const enrichedQuestion = allQuestions.find((item) => item.id === questionId) || nextQuestion;
    setQuestions(allQuestions);
    setQuestion(enrichedQuestion);
    setAnswers(nextAnswers);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [questionId]);

  const goToQuestion = (direction) => {
    if (!questions.length) return;
    const index = questions.findIndex((item) => item.id === questionId);
    const safeIndex = index >= 0 ? index : 0;
    const nextIndex = (safeIndex + direction + questions.length) % questions.length;
    const nextQuestion = questions[nextIndex];
    if (nextQuestion?.id && nextQuestion.id !== questionId) {
      router.replace(`/leaderboard/${nextQuestion.id}`, { scroll: false });
    }
  };

  const submitAnswer = async () => {
    if (!user?.uid) {
      router.push("/?auth=1");
      return;
    }
    if (!answerText.trim() || submitting) return;
    setSubmitting(true);
    const ok = await addLeaderboardAnswer(questionId, user, { text: answerText, anonymous });
    if (ok) {
      setAnswerText("");
      await load();
    }
    setSubmitting(false);
  };

  const vote = async (answer) => {
    if (!user?.uid) {
      router.push("/?auth=1");
      return;
    }
    if (Array.isArray(answer.votes) && answer.votes.includes(user.uid)) return;
    const ok = await voteLeaderboardAnswer(questionId, answer.id, user.uid);
    if (ok) await load();
  };

  const isSwipeBlockedTarget = (target) => {
    return Boolean(target?.closest?.("button,input,textarea,select,a,[data-no-question-swipe='true']"));
  };

  const startSwipe = (x, y, target) => {
    if (isSwipeBlockedTarget(target)) {
      swipeRef.current = null;
      return;
    }
    swipeRef.current = { x, y, t: Date.now() };
  };

  const endSwipe = (x, y) => {
    const start = swipeRef.current;
    swipeRef.current = null;
    if (!start) return;
    const dx = x - start.x;
    const dy = y - start.y;
    if (Math.abs(dx) < 42 || Math.abs(dx) < Math.abs(dy) * 1.1) return;
    goToQuestion(dx < 0 ? 1 : -1);
  };

  const handlePointerDown = (event) => {
    startSwipe(event.clientX, event.clientY, event.target);
  };

  const handlePointerUp = (event) => {
    endSwipe(event.clientX, event.clientY);
  };

  const handleTouchStart = (event) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    startSwipe(touch.clientX, touch.clientY, event.target);
  };

  const handleTouchEnd = (event) => {
    const touch = event.changedTouches?.[0];
    if (!touch) return;
    endSwipe(touch.clientX, touch.clientY);
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[#050505] px-5 pt-[max(env(safe-area-inset-top),1rem)] text-white">
        <div className="pt-20 text-center text-white/50">Loading leaderboard...</div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="min-h-[100dvh] bg-[#050505] px-5 pt-[max(env(safe-area-inset-top),1rem)] text-white">
        <button type="button" onClick={() => router.back()} className="mt-8 flex h-12 w-12 items-center justify-center rounded-[1rem] bg-white/8">
          <ArrowLeft />
        </button>
        <div className="pt-20 text-center text-white/60">Leaderboard not found.</div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#050505] text-white">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-xl flex-col px-5 pb-8 pt-[max(env(safe-area-inset-top),1rem)]">
        <div className="flex items-center justify-between py-6">
          <button type="button" onClick={() => router.back()} className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-white/8">
            <ArrowLeft size={24} />
          </button>
          <div className="flex items-center gap-2 text-lg font-black">
            Leaderboard
            <PodiumIcon className="h-6 w-6 text-[#D7B443]" />
          </div>
          <button type="button" className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-white/8">
            <MoreHorizontal size={22} />
          </button>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm font-bold text-white/35">
            {questions.length ? `${currentIndex + 1}/${questions.length}` : ""}
          </div>
          <button type="button" className="flex h-12 w-12 items-center justify-center rounded-full border border-white/12 bg-white/5">
            <Share size={21} />
          </button>
        </div>

        <div
          className="relative touch-pan-y select-none"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onPointerCancel={() => {
            swipeRef.current = null;
          }}
        >
          <div
            className="rounded-[2rem] border border-white/10 bg-[#101010] p-5 shadow-[0_0_42px_rgba(0,0,0,0.42)]"
            style={{ boxShadow: `0 0 34px ${accent.glow}, 0 20px 58px rgba(0,0,0,0.36)` }}
          >
            <div className="mb-5">
              <div className="mb-4 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.08em]" style={{ color: accent.main }}>
                {hot ? <Flame size={18} fill="currentColor" /> : null}
                {question.label || "IN TREND"}
              </div>
              <h1 className="max-w-[94%] text-[2.35rem] font-black leading-[1.06] tracking-[-0.04em]">{question.title}</h1>
              <div className="mt-5 text-base font-semibold text-white/42">
                {Math.max(0, totalVotes)} voti · {rankedAnswers.length} risposte
              </div>
            </div>

            <div className="mb-5 space-y-2">
              {rankedAnswers.slice(0, 8).map((answer, index) => {
                const alreadyVoted = user?.uid && Array.isArray(answer.votes) && answer.votes.includes(user.uid);
                return (
                  <button
                    type="button"
                    key={answer.id}
                    onClick={() => vote(answer)}
                    data-no-question-swipe="true"
                    className="flex w-full items-center gap-3 rounded-[1.25rem] bg-[#171717] p-3.5 text-left shadow-[0_12px_28px_rgba(0,0,0,0.18)]"
                  >
                    <div className="w-8 text-center text-[1.25rem] font-black" style={{ color: index < 3 ? accent.main : "rgba(255,255,255,0.55)" }}>
                      {index + 1}
                    </div>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem]" style={{ background: accent.soft }}>
                      <MessageCircle size={22} style={{ color: accent.main }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-black">{answer.text}</div>
                      <div className="mt-1 truncate text-xs text-white/45">
                        {answer.anonymous ? "Anonimo" : answer.userName || "User"}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-base font-black" style={{ color: accent.main }}>
                      <Flame size={18} />
                      {voteCount(answer)}
                    </div>
                    {alreadyVoted ? <span className="sr-only">Voted</span> : null}
                  </button>
                );
              })}
            </div>

            <div className="rounded-[1.45rem] border border-white/10 bg-[#0B0B0B] p-4">
              <div className="mb-3 text-lg font-black">Aggiungi la tua risposta</div>
              <input
                data-no-question-swipe="true"
                value={answerText}
                onChange={(event) => setAnswerText(event.target.value)}
                placeholder="Scrivi la tua risposta"
                className="mb-3 w-full rounded-[1.15rem] border border-white/12 bg-[#050505] px-4 py-4 text-[16px] text-white placeholder:text-white/28 focus:outline-none focus:ring-2 focus:ring-white/10"
              />
              <button
                type="button"
                onClick={submitAnswer}
                disabled={submitting || !answerText.trim()}
                data-no-question-swipe="true"
                className="w-full rounded-[1.15rem] px-5 py-4 text-base font-black text-white disabled:opacity-45"
                style={{ background: accent.main }}
              >
                {submitting ? "Invio..." : "Aggiungi e vota"}
              </button>
              <button
                type="button"
                onClick={() => setAnonymous((value) => !value)}
                data-no-question-swipe="true"
                className="mt-4 flex w-full items-center justify-center gap-2 text-sm font-bold text-white/34"
              >
                <Lock size={16} />
                {anonymous ? "Il tuo voto è anonimo" : "Risposta visibile sul profilo"}
              </button>
            </div>
          </div>
          {questions.length > 1 ? (
            <div className="mt-4 text-center text-xs font-semibold text-white/28">
              {t("Swipe between leaderboard questions")}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
