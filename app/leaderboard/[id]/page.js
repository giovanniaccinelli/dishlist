"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Flame, Lock, MessageCircle, MoreHorizontal, Share, Trophy } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { addLeaderboardAnswer, getLeaderboardAnswers, getLeaderboardQuestion, voteLeaderboardAnswer } from "../../lib/firebaseHelpers";
import { useLanguage } from "../../../components/LanguageProvider";

const accentMap = {
  red: { main: "#E64646", soft: "rgba(230,70,70,0.16)" },
  orange: { main: "#F26A21", soft: "rgba(242,106,33,0.16)" },
  yellow: { main: "#D7B443", soft: "rgba(215,180,67,0.16)" },
  blue: { main: "#5CB7E8", soft: "rgba(92,183,232,0.16)" },
  pink: { main: "#D96EEA", soft: "rgba(217,110,234,0.16)" },
};

function voteCount(answer) {
  return Array.isArray(answer?.votes) ? answer.votes.length : 0;
}

export default function LeaderboardQuestionPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const questionId = params?.id;
  const [question, setQuestion] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [answerText, setAnswerText] = useState("");
  const [anonymous, setAnonymous] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const accent = accentMap[question?.accent] || accentMap.red;
  const rankedAnswers = useMemo(
    () => [...answers].sort((a, b) => voteCount(b) - voteCount(a) || (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)),
    [answers]
  );
  const totalVotes = rankedAnswers.reduce((sum, answer) => sum + voteCount(answer), 0);

  const load = async () => {
    if (!questionId) return;
    setLoading(true);
    const [nextQuestion, nextAnswers] = await Promise.all([
      getLeaderboardQuestion(questionId),
      getLeaderboardAnswers(questionId),
    ]);
    setQuestion(nextQuestion);
    setAnswers(nextAnswers);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [questionId]);

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
            <Trophy size={22} className="text-[#D7B443]" />
          </div>
          <button type="button" className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-white/8">
            <MoreHorizontal size={22} />
          </button>
        </div>

        <div className="mb-5 flex justify-end">
          <button type="button" className="flex h-12 w-12 items-center justify-center rounded-full border border-white/12 bg-white/5">
            <Share size={21} />
          </button>
        </div>

        <div className="mb-6">
          <div className="mb-4 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.08em]" style={{ color: accent.main }}>
            <Flame size={18} fill="currentColor" />
            {question.label || "IN TREND"}
          </div>
          <h1 className="max-w-[92%] text-[2.45rem] font-black leading-[1.06] tracking-[-0.04em]">{question.title}</h1>
          <div className="mt-5 text-base font-semibold text-white/42">
            {Math.max(0, totalVotes)} voti · {rankedAnswers.length} risposte
          </div>
        </div>

        <div className="mb-7 space-y-2">
          {rankedAnswers.slice(0, 8).map((answer, index) => {
            const alreadyVoted = user?.uid && Array.isArray(answer.votes) && answer.votes.includes(user.uid);
            return (
              <button
                type="button"
                key={answer.id}
                onClick={() => vote(answer)}
                className="flex w-full items-center gap-4 rounded-[1.25rem] bg-[#141414] p-4 text-left shadow-[0_14px_32px_rgba(0,0,0,0.2)]"
              >
                <div className="w-9 text-center text-[1.35rem] font-black" style={{ color: index < 3 ? accent.main : "rgba(255,255,255,0.55)" }}>
                  {index + 1}
                </div>
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1rem]" style={{ background: accent.soft }}>
                  <MessageCircle size={24} style={{ color: accent.main }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-lg font-black">{answer.text}</div>
                  <div className="mt-1 truncate text-sm text-white/45">
                    {answer.anonymous ? "Anonimo" : answer.userName || "User"}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-lg font-black" style={{ color: accent.main }}>
                  <Flame size={20} />
                  {voteCount(answer)}
                </div>
                {alreadyVoted ? <span className="sr-only">Voted</span> : null}
              </button>
            );
          })}
        </div>

        <div className="mt-auto rounded-[1.45rem] border border-white/10 bg-[#111111] p-4 shadow-[0_-10px_50px_rgba(255,255,255,0.04)]">
          <div className="mb-3 text-lg font-black">Aggiungi la tua risposta</div>
          <input
            value={answerText}
            onChange={(event) => setAnswerText(event.target.value)}
            placeholder="Scrivi la tua risposta"
            className="mb-3 w-full rounded-[1.15rem] border border-white/12 bg-[#0A0A0A] px-4 py-4 text-[16px] text-white placeholder:text-white/28 focus:outline-none focus:ring-2 focus:ring-white/10"
          />
          <button
            type="button"
            onClick={submitAnswer}
            disabled={submitting || !answerText.trim()}
            className="w-full rounded-[1.15rem] px-5 py-4 text-base font-black text-white disabled:opacity-45"
            style={{ background: accent.main }}
          >
            {submitting ? "Invio..." : "Aggiungi e vota"}
          </button>
          <button
            type="button"
            onClick={() => setAnonymous((value) => !value)}
            className="mt-4 flex w-full items-center justify-center gap-2 text-sm font-bold text-white/34"
          >
            <Lock size={16} />
            {anonymous ? "Il tuo voto è anonimo" : "Risposta visibile sul profilo"}
          </button>
        </div>
      </div>
    </div>
  );
}
