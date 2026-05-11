"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence, animate, useMotionValue, useTransform } from "framer-motion";
import { ArrowLeft, Flame, Lock, LockOpen, MessageCircle } from "lucide-react";
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
  const [isEjecting, setIsEjecting] = useState(false);
  const dragX = useMotionValue(0);
  const cardRotate = useTransform(dragX, [-240, 0, 240], [-14, 0, 14]);

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
    const ok = await voteLeaderboardAnswer(questionId, answer.id, user.uid);
    if (ok) await load();
  };

  const stopCardDrag = (event) => {
    event.stopPropagation();
  };

  const handleQuestionDragEnd = async (_event, info) => {
    if (isEjecting) return;
    const offsetX = info?.offset?.x || 0;
    if (Math.abs(offsetX) < 70) {
      animate(dragX, 0, {
        type: "spring",
        stiffness: 420,
        damping: 34,
        mass: 0.55,
      });
      return;
    }
    const direction = offsetX > 0 ? -1 : 1;
    const targetX = (offsetX > 0 ? 1 : -1) * (typeof window !== "undefined" ? window.innerWidth * 1.2 : 700);
    setIsEjecting(true);
    try {
      await animate(dragX, targetX, {
        type: "spring",
        stiffness: 280,
        damping: 28,
        mass: 0.6,
      }).finished;
    } catch {}
    dragX.set(0);
    setIsEjecting(false);
    goToQuestion(direction);
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
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-xl flex-col px-5 pb-8 pt-[max(env(safe-area-inset-top),0.5rem)]">
        <div className="flex items-center justify-between py-2">
          <button type="button" onClick={() => router.back()} className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-white/8">
            <ArrowLeft size={24} />
          </button>
          <div className="flex items-center gap-2 text-lg font-black">
            Leaderboard
            <PodiumIcon className="h-6 w-6 text-[#D7B443]" />
          </div>
          <div className="h-12 w-12" />
        </div>

        <div className="relative mt-0 touch-none select-none">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={question.id}
              drag={questions.length > 1 && !isEjecting ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.9}
              onDragEnd={handleQuestionDragEnd}
              initial={{ opacity: 0, scale: 0.985 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.985 }}
              transition={{ type: "spring", stiffness: 360, damping: 32 }}
              className="cursor-grab rounded-[1.7rem] border border-white/10 bg-[#101010] p-4 shadow-[0_0_42px_rgba(0,0,0,0.42)] active:cursor-grabbing"
              style={{ x: dragX, rotate: cardRotate, boxShadow: `0 0 28px ${accent.glow}, 0 16px 46px rgba(0,0,0,0.34)` }}
            >
            <div className="mb-3">
              <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.08em]" style={{ color: accent.main }}>
                {hot ? <Flame size={18} fill="currentColor" /> : null}
                {question.label || "IN TREND"}
              </div>
              <h1 className="max-w-[94%] text-[1.95rem] font-black leading-[1.06] tracking-[-0.04em]">{question.title}</h1>
              <div className="mt-3 text-sm font-semibold text-white/42">
                {Math.max(0, totalVotes)} voti · {rankedAnswers.length} risposte
              </div>
            </div>

            <div className="mb-3 space-y-2">
              {rankedAnswers.slice(0, 5).map((answer, index) => {
                const alreadyVoted = user?.uid && Array.isArray(answer.votes) && answer.votes.includes(user.uid);
                return (
                  <button
                    type="button"
                    key={answer.id}
                    onClick={() => vote(answer)}
                    data-no-question-swipe="true"
                    onPointerDownCapture={stopCardDrag}
                    onTouchStartCapture={stopCardDrag}
                    className={`flex w-full items-center gap-3 rounded-[1.1rem] p-3 text-left shadow-[0_12px_28px_rgba(0,0,0,0.18)] transition ${
                      alreadyVoted ? "bg-[#211515] ring-2 ring-[#E64646]/80" : "bg-[#171717]"
                    }`}
                  >
                    <div className="w-8 text-center text-[1.25rem] font-black" style={{ color: index < 3 ? accent.main : "rgba(255,255,255,0.55)" }}>
                      {index + 1}
                    </div>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.9rem]" style={{ background: accent.soft }}>
                      <MessageCircle size={19} style={{ color: accent.main }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[0.95rem] font-black">{answer.text}</div>
                      <div className="mt-1 truncate text-xs text-white/45">
                        {answer.anonymous ? "Anonimo" : answer.userName || "User"}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-sm font-black" style={{ color: accent.main }}>
                      <Flame size={16} />
                      {voteCount(answer)}
                    </div>
                    {alreadyVoted ? <span className="sr-only">Voted</span> : null}
                  </button>
                );
              })}
            </div>

            <div
              className="rounded-[1.25rem] border border-white/10 bg-[#0B0B0B] p-3"
              onPointerDownCapture={stopCardDrag}
              onTouchStartCapture={stopCardDrag}
            >
              <div className="mb-2 text-base font-black">Aggiungi la tua risposta</div>
              <input
                data-no-question-swipe="true"
                value={answerText}
                onChange={(event) => setAnswerText(event.target.value)}
                placeholder="Scrivi la tua risposta"
                className="mb-2 w-full rounded-[1rem] border border-white/12 bg-[#050505] px-4 py-3 text-[16px] text-white placeholder:text-white/28 focus:outline-none focus:ring-2 focus:ring-white/10"
              />
              <button
                type="button"
                onClick={submitAnswer}
                disabled={submitting || !answerText.trim()}
                data-no-question-swipe="true"
                className="w-full rounded-[1rem] px-5 py-3 text-sm font-black text-white disabled:opacity-45"
                style={{ background: accent.main }}
              >
                {submitting ? "Invio..." : "Aggiungi e vota"}
              </button>
              <button
                type="button"
                onClick={() => setAnonymous((value) => !value)}
                data-no-question-swipe="true"
                className="mt-3 flex w-full items-center justify-center gap-2 text-sm font-bold text-white/34"
              >
                {anonymous ? <Lock size={16} /> : <LockOpen size={16} />}
                {anonymous ? "Il tuo voto è anonimo" : "Risposta visibile sul profilo"}
              </button>
            </div>
            </motion.div>
          </AnimatePresence>
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
