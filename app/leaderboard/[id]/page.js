"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, animate, useMotionValue, useTransform } from "framer-motion";
import { ArrowLeft, Flame, Lock, LockOpen, MessageCircle, Users, X } from "lucide-react";
import { useAuth } from "../../lib/auth";
import {
  addLeaderboardAnswer,
  getLeaderboardAnswers,
  getLeaderboardQuestion,
  getLeaderboardQuestions,
  getUsersByIds,
  voteLeaderboardAnswer,
} from "../../lib/firebaseHelpers";
import { useLanguage } from "../../../components/LanguageProvider";

function getQuestionTone(question) {
  return question?.dishMode === "home"
    ? { main: "#E4B43F", soft: "rgba(228,180,63,0.16)", glow: "rgba(228,180,63,0.24)" }
    : { main: "#E64646", soft: "rgba(230,70,70,0.16)", glow: "rgba(230,70,70,0.25)" };
}

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
  const [activeQuestionId, setActiveQuestionId] = useState(questionId || "");
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [answersLoading, setAnswersLoading] = useState(false);
  const [answerText, setAnswerText] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isEjecting, setIsEjecting] = useState(false);
  const [votingAnswerId, setVotingAnswerId] = useState("");
  const [voterModal, setVoterModal] = useState(null);
  const dragX = useMotionValue(0);
  const cardRotate = useTransform(dragX, [-240, 0, 240], [-14, 0, 14]);

  const question = useMemo(
    () => questions.find((item) => item.id === activeQuestionId) || null,
    [activeQuestionId, questions]
  );
  const accent = getQuestionTone(question);
  const rankedAnswers = useMemo(
    () => [...answers].sort((a, b) => voteCount(b) - voteCount(a) || (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)),
    [answers]
  );
  const totalVotes = rankedAnswers.reduce((sum, answer) => sum + voteCount(answer), 0);
  const hot = Number(question?.recentVotes || 0) > 0;

  const loadQuestions = async () => {
    if (!questionId) return;
    setLoading(true);
    const [allQuestions, nextQuestion] = await Promise.all([
      getLeaderboardQuestions(40),
      getLeaderboardQuestion(questionId),
    ]);
    const mergedQuestions = nextQuestion && !allQuestions.some((item) => item.id === nextQuestion.id)
      ? [nextQuestion, ...allQuestions]
      : allQuestions;
    setQuestions(mergedQuestions);
    setActiveQuestionId((current) => current || questionId);
    setLoading(false);
  };

  const loadAnswers = async (targetQuestionId = activeQuestionId) => {
    if (!targetQuestionId) return;
    setAnswersLoading(true);
    let nextAnswers = await getLeaderboardAnswers(targetQuestionId);
    if (user?.uid) {
      const votedAnswers = nextAnswers.filter((answer) => Array.isArray(answer.votes) && answer.votes.includes(user.uid));
      if (votedAnswers.length > 1) {
        const timestampToMs = (value) => {
          if (!value) return 0;
          if (typeof value.toMillis === "function") return value.toMillis();
          if (typeof value.seconds === "number") return value.seconds * 1000;
          const parsed = Date.parse(value);
          return Number.isFinite(parsed) ? parsed : 0;
        };
        const keeper = votedAnswers
          .slice()
          .sort((a, b) => timestampToMs(b.voteTimestamps?.[user.uid]) - timestampToMs(a.voteTimestamps?.[user.uid]))[0];
        if (keeper?.id) {
          await voteLeaderboardAnswer(targetQuestionId, keeper.id, user.uid, { anonymous: Boolean(keeper.voteAnonymous?.[user.uid]) });
          nextAnswers = await getLeaderboardAnswers(targetQuestionId);
        }
      }
    }
    setAnswers(nextAnswers);
    setAnswersLoading(false);
  };

  useEffect(() => {
    loadQuestions();
  }, [questionId]);

  useEffect(() => {
    loadAnswers(activeQuestionId);
  }, [activeQuestionId, user?.uid]);

  const goToQuestion = (direction) => {
    if (!questions.length) return;
    const index = questions.findIndex((item) => item.id === questionId);
    const activeIndex = questions.findIndex((item) => item.id === activeQuestionId);
    const safeIndex = activeIndex >= 0 ? activeIndex : index >= 0 ? index : 0;
    const nextIndex = (safeIndex + direction + questions.length) % questions.length;
    const nextQuestion = questions[nextIndex];
    if (nextQuestion?.id && nextQuestion.id !== activeQuestionId) {
      setActiveQuestionId(nextQuestion.id);
    }
  };

  const submitAnswer = async () => {
    if (!user?.uid) {
      router.push("/?auth=1");
      return;
    }
    if (!answerText.trim() || submitting) return;
    setSubmitting(true);
    const ok = await addLeaderboardAnswer(activeQuestionId, user, { text: answerText, anonymous });
    if (ok) {
      setAnswerText("");
      await loadAnswers(activeQuestionId);
    }
    setSubmitting(false);
  };

  const vote = async (answer) => {
    if (!user?.uid) {
      router.push("/?auth=1");
      return;
    }
    if (!answer?.id || votingAnswerId) return;
    setVotingAnswerId(answer.id);
    setAnswers((prev) =>
      prev.map((item) => {
        const votes = Array.isArray(item.votes) ? item.votes.filter((id) => id !== user.uid) : [];
        return item.id === answer.id ? { ...item, votes: [...votes, user.uid] } : { ...item, votes };
      })
    );
    const ok = await voteLeaderboardAnswer(activeQuestionId, answer.id, user.uid, { anonymous });
    if (ok) {
      await loadAnswers(activeQuestionId);
    } else {
      await loadAnswers(activeQuestionId);
    }
    setVotingAnswerId("");
  };

  const openVoters = async (answer) => {
    const voteIds = Array.isArray(answer?.votes) ? answer.votes.filter(Boolean) : [];
    if (!voteIds.length) {
      setVoterModal({ title: answer?.text || "", voters: [] });
      return;
    }
    const users = await getUsersByIds(voteIds);
    const usersById = new Map(users.map((item) => [item.id, item]));
    setVoterModal({
      title: answer?.text || "",
      voters: voteIds.map((id) => {
        const isAnonymous = Boolean(answer?.voteAnonymous?.[id]);
        const voter = usersById.get(id);
        return {
          id,
          name: isAnonymous ? "Anonimo" : voter?.displayName || voter?.name || "User",
          anonymous: isAnonymous,
        };
      }),
    });
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
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-xl flex-col px-5 pb-8 pt-[calc(env(safe-area-inset-top)+2.35rem)]">
        <div className="flex items-center justify-between py-3">
          <button type="button" onClick={() => router.back()} className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-white/8">
            <ArrowLeft size={24} />
          </button>
          <div className="flex items-center gap-2 text-lg font-black">
            Leaderboard
            <PodiumIcon className="h-6 w-6 text-[#D7B443]" />
          </div>
          <div className="h-12 w-12" />
        </div>

        <div className="relative mt-0 flex flex-1 touch-none select-none">
          <motion.div
            key={question.id}
            drag={questions.length > 1 && !isEjecting ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.9}
            onDragEnd={handleQuestionDragEnd}
            initial={{ opacity: 1, scale: 1 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 360, damping: 32 }}
            className="flex min-h-[calc(100dvh-10.5rem)] w-full cursor-grab flex-col rounded-[1.7rem] border-2 bg-[#101010] p-4 active:cursor-grabbing"
            style={{ x: dragX, rotate: cardRotate, borderColor: accent.main, boxShadow: `0 16px 42px rgba(0,0,0,0.36), 0 0 18px ${accent.glow}` }}
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

            <div className={`mb-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 transition-opacity [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${answersLoading ? "opacity-55" : "opacity-100"}`}>
              {rankedAnswers.map((answer, index) => {
                const alreadyVoted = user?.uid && Array.isArray(answer.votes) && answer.votes.includes(user.uid);
                return (
                  <div
                    key={answer.id}
                    data-no-question-swipe="true"
                    onPointerDownCapture={stopCardDrag}
                    onTouchStartCapture={stopCardDrag}
                    className={`flex w-full items-center gap-3 rounded-[1.1rem] border p-3 text-left shadow-[0_10px_24px_rgba(0,0,0,0.16)] transition ${
                      alreadyVoted ? "bg-[#241515]" : "bg-[#171717]"
                    }`}
                    style={{
                      borderColor: alreadyVoted ? accent.main : "rgba(255,255,255,0.08)",
                      boxShadow: alreadyVoted ? `inset 0 0 0 1px ${accent.main}, 0 10px 24px rgba(0,0,0,0.16)` : "0 10px 24px rgba(0,0,0,0.16)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => vote(answer)}
                      disabled={Boolean(votingAnswerId)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
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
                    </button>
                    <button
                      type="button"
                      onClick={() => openVoters(answer)}
                      className="flex items-center justify-center text-white/45 transition hover:text-white"
                      aria-label="Show voters"
                    >
                      <Users size={17} />
                    </button>
                    <div className="flex items-center gap-1 text-sm font-black" style={{ color: accent.main }}>
                      <Flame size={16} />
                      {voteCount(answer)}
                    </div>
                    {alreadyVoted ? <span className="sr-only">Voted</span> : null}
                  </div>
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
          {questions.length > 1 ? (
            <div className="mt-4 text-center text-xs font-semibold text-white/28">
              {t("Swipe between leaderboard questions")}
            </div>
          ) : null}
        </div>
      </div>
      {voterModal ? (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/55 px-4 pb-6" onClick={() => setVoterModal(null)}>
          <div className="w-full max-w-sm rounded-[1.5rem] border border-white/10 bg-[#111111] p-4 text-white shadow-[0_20px_70px_rgba(0,0,0,0.45)]" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-base font-black">Voti</div>
                <div className="mt-0.5 max-w-[15rem] truncate text-xs text-white/45">{voterModal.title}</div>
              </div>
              <button type="button" onClick={() => setVoterModal(null)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/8">
                <X size={17} />
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {voterModal.voters.length ? (
                voterModal.voters.map((voter) => (
                  <div key={voter.id} className="flex items-center justify-between border-t border-white/8 py-3 text-sm font-semibold">
                    <span>{voter.name}</span>
                    {voter.anonymous ? <Lock size={14} className="text-white/35" /> : null}
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-sm text-white/45">Nessun voto</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
