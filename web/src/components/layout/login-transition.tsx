"use client";

import { useEffect, useRef, useState } from "react";

type Phase = "logo" | "status" | "fadeout" | "done";

const STATUS_LINES = [
  { key: "auth", text: "Authenticating...", done: "Authenticated" },
  { key: "data", text: "Loading project data...", done: "Project loaded" },
  { key: "dash", text: "Preparing dashboard...", done: "Ready" },
];

export function LoginTransition({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase | "check">("check");
  const [visibleLines, setVisibleLines] = useState(0);
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const flag = sessionStorage.getItem("nis-just-logged-in");

    if (!flag || prefersReduced) {
      setPhase("done");
      return;
    }

    setPhase("logo");

    const t1 = setTimeout(() => setPhase("status"), 900);
    const t2 = setTimeout(() => setVisibleLines(1), 1000);
    const t3 = setTimeout(() => setVisibleLines(2), 1250);
    const t4 = setTimeout(() => setVisibleLines(3), 1500);
    const t5 = setTimeout(() => setPhase("fadeout"), 1900);
    const t6 = setTimeout(() => {
      sessionStorage.removeItem("nis-just-logged-in");
      setPhase("done");
    }, 2400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      clearTimeout(t6);
    };
  }, []);

  function skip() {
    if (phase !== "done") {
      sessionStorage.removeItem("nis-just-logged-in");
      setPhase("done");
    }
  }

  if (phase === "check") {
    return <div className="min-h-screen bg-[#141b26]" />;
  }

  if (phase === "done") {
    return (
      <div
        style={{ animation: "nis-fade-in 0.5s ease-out both" }}
      >
        {children}
      </div>
    );
  }

  return (
    <>
      {/* Dashboard renders behind the overlay */}
      <div className="invisible" aria-hidden>
        {children}
      </div>

      {/* Transition overlay */}
      <div
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#141b26]"
        style={
          phase === "fadeout"
            ? { animation: "nis-fade-out 0.4s ease-in forwards" }
            : undefined
        }
        onClick={skip}
        onKeyDown={skip}
        role="presentation"
      >
        {/* Background glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(34,211,238,0.08) 0%, transparent 70%)",
          }}
        />

        {/* Pulse ring */}
        {(phase === "logo" || phase === "status") && (
          <div
            className="absolute rounded-full border border-cyan-400/30"
            style={{
              width: 120,
              height: 120,
              animation: "nis-pulse-ring 1s ease-out forwards",
            }}
          />
        )}

        {/* Logo */}
        <div
          style={{
            animation: "nis-fade-in 0.35s ease-out both",
          }}
        >
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-white">NIS</h1>
            <p
              className="mt-2 text-[10px] font-medium uppercase tracking-[0.25em] text-slate-500"
              style={{
                animation: "nis-fade-in 0.35s ease-out 0.2s both",
              }}
            >
              Nihon Insight System
            </p>
          </div>
        </div>

        {/* Status lines */}
        {(phase === "status" || phase === "fadeout") && (
          <div className="mt-10 w-64 space-y-2 font-mono text-xs">
            {STATUS_LINES.map((line, i) => {
              if (i >= visibleLines) return null;
              const isDone = i < visibleLines - 1 || phase === "fadeout";
              return (
                <div
                  key={line.key}
                  className="relative"
                  style={{
                    animation: "nis-stagger-in 0.25s ease-out both",
                  }}
                >
                  <span className={isDone ? "text-emerald-400" : "text-slate-500"}>
                    {isDone ? "✓" : "▸"}{" "}
                    {isDone ? line.done : line.text}
                  </span>
                  {!isDone && (
                    <div
                      className="absolute bottom-0 left-0 h-px bg-cyan-400/30"
                      style={{
                        animation: "nis-scan-line 0.6s ease-out forwards",
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Skip hint */}
        <p className="absolute bottom-8 text-[10px] text-slate-600">
          クリックでスキップ
        </p>
      </div>
    </>
  );
}
