"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  getNextMilestones,
  getCelebrationEvents,
  type MilestoneAssessment,
} from "@/lib/milestone-grading";
import { milestoneHelpHref } from "@/lib/milestone-guides";

export function milestoneHistoryKey(
  userScope: string,
  clientId: string,
  version: string,
) {
  return `convert:milestones:${encodeURIComponent(version)}:${encodeURIComponent(userScope)}:${encodeURIComponent(clientId)}`;
}
export function advanceMilestoneHistory(
  assessment: MilestoneAssessment,
  previous: string[] | null,
) {
  const completed = assessment.milestones
    .filter((m) => m.complete)
    .map((m) => m.id);
  return {
    seenIds: [...new Set([...(previous || []), ...completed])],
    events: previous === null ? [] : getCelebrationEvents(assessment, previous),
  };
}
export default function MilestoneProgress({
  assessment,
  clientId,
  clientName,
  userScope,
}: {
  assessment: MilestoneAssessment;
  clientId: string;
  clientName?: string | null;
  userScope: string;
}) {
  const [offset, setOffset] = useState(0);
  const [celebration, setCelebration] = useState("");
  const history = useRef<{ key: string; seen: string[] } | null>(null);
  const key = milestoneHistoryKey(userScope, clientId, assessment.version);
  useEffect(() => {
    let active = true;
    let seen = history.current?.key === key ? history.current.seen : null;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const value: unknown = JSON.parse(raw);
        if (
          Array.isArray(value) &&
          value.every((v) => typeof v === "string") &&
          value.length <= 100
        )
          seen = [...new Set([...(seen || []), ...value])];
      }
    } catch {
      /* A blocked store must not prevent progress or replay celebrations. */
    }
    const next = advanceMilestoneHistory(assessment, seen);
    history.current = { key, seen: next.seenIds };
    try {
      localStorage.setItem(key, JSON.stringify(next.seenIds));
    } catch {
      /* In-memory history still prevents replays during this visit. */
    }
    queueMicrotask(() => {
      if (active)
        setCelebration(
          next.events.length
            ? `Milestone complete: ${next.events.map((e) => e.title).join(", ")}!`
            : "",
        );
    });
    const timer = setTimeout(() => {
      if (active) setCelebration("");
    }, 4500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [assessment, key]);
  const next = getNextMilestones(assessment, offset);
  const pending = assessment.milestones.filter((m) => !m.complete).length;
  return (
    <section
      aria-label="Website progress"
      className="relative space-y-5 rounded-2xl border border-slate-200 bg-white p-5 text-slate-950 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
            Your conversion journey
          </p>
          <h2 className="mt-1 text-xl font-semibold">{assessment.stage}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {assessment.connected
              ? assessment.connectionKind === "upload"
                ? "Supported upload · user-supplied data"
                : "Analytics access confirmed"
              : "Connect your site to begin—not a failing grade."}
          </p>
        </div>
        <div className="text-right">
          <p
            className="text-4xl font-bold tabular-nums"
            aria-label={`Progress score ${assessment.score} out of 100`}
          >
            {assessment.score}
            <span className="text-base font-normal text-slate-500">/100</span>
          </p>
          <p className="mt-1 text-xs">
            Readiness {assessment.readinessScore}/70 · Results{" "}
            {assessment.resultsScore}/29
          </p>
        </div>
      </div>
      <div
        role="progressbar"
        aria-label="Overall milestone progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={assessment.score}
        className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
      >
        <div
          className="milestone-bar h-full rounded-full bg-emerald-600"
          style={{ width: `${assessment.score}%` }}
        />
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {assessment.explanation}
      </p>
      <div
        role="status"
        aria-live="polite"
        className={
          celebration
            ? "rounded-lg bg-emerald-50 p-3 font-semibold text-emerald-900"
            : "sr-only"
        }
      >
        {celebration}
      </div>
      {celebration && (
        <div
          aria-hidden="true"
          className="milestone-confetti pointer-events-none absolute inset-x-0 top-0 h-40 overflow-hidden"
        >
          {Array.from({ length: 28 }, (_, i) => (
            <span
              key={i}
              style={{
                left: `${(i * 37) % 100}%`,
                background: ["#059669", "#f59e0b", "#3b82f6", "#e879f9"][i % 4],
                animationDelay: `${(i % 7) * 0.06}s`,
                transform: `rotate(${i * 29}deg)`,
              }}
            />
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
        <h3 className="text-lg font-semibold">Your next steps</h3>
        {pending > 3 && (
          <button
            type="button"
            className="rounded border px-3 py-1.5 text-sm"
            onClick={() => setOffset((v) => v + 1)}
          >
            Show other options
          </button>
        )}
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {next.map((m, index) => (
          <article
            key={m.id}
            data-next-step={m.id}
            className="flex flex-col rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900"
          >
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              {index === 0 ? "Recommended next" : "Another useful option"} · Up
              to {m.maxPoints - m.points} points
            </p>
            <h4 className="mt-2 font-semibold">{m.title}</h4>
            <p className="mt-2 text-sm">{m.description}</p>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
              {m.evidence}
            </p>
            <div className="mt-auto flex flex-col gap-2 pt-4">
              <Link
                className="rounded-lg bg-emerald-700 px-3 py-2 text-center text-sm font-semibold text-white"
                href={`/guides/${m.guideSlug}`}
              >
                Show me how
              </Link>
              <a
                className="text-center text-sm underline"
                href={milestoneHelpHref(m.title, clientName)}
              >
                Get help from George
              </a>
              <Link
                className="text-center text-xs underline"
                href={`/dashboard/${encodeURIComponent(clientId)}/edit`}
              >
                Update my setup
              </Link>
            </div>
          </article>
        ))}
        {!next.length && (
          <p className="text-sm">
            All current milestones are complete. Keep reviewing results—there is
            still room to improve.
          </p>
        )}
      </div>
      <details className="border-t border-slate-200 pt-3 dark:border-slate-700">
        <summary className="cursor-pointer text-sm font-semibold">
          See all milestones and scoring limits
        </summary>
        <ul className="mt-3 space-y-3">
          {assessment.milestones.map((m) => (
            <li key={m.id} className="text-sm">
              <span className="font-medium">
                {m.complete ? "✓ " : "○ "}
                {m.title} — {m.points}/{m.maxPoints}
              </span>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                {m.evidence}
              </p>
            </li>
          ))}
        </ul>
        <ul className="mt-4 list-disc space-y-2 pl-4 text-xs">
          {assessment.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs">
          Celebration history stays in this browser for this account and
          website. It is not the scoring ledger. Learning or buying help alone
          does not earn points. Rules: {assessment.version}.
        </p>
      </details>
      <style>{`.milestone-bar{transition:width .7s ease}.milestone-confetti span{position:absolute;top:-12px;width:8px;height:14px;animation:convert-confetti 2.3s ease-out forwards}@keyframes convert-confetti{to{top:160px;transform:rotate(500deg);opacity:0}}@media(prefers-reduced-motion:reduce){.milestone-bar{transition:none}.milestone-confetti{display:none}}@media print{.milestone-confetti{display:none}}`}</style>
    </section>
  );
}
