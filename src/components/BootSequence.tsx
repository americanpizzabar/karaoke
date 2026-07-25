"use client";

import { useEffect, useState } from "react";
import { SegmentDisplay } from "@/components/SegmentDisplay";

/**
 * 起動シーケンス(仕様書 5章)。
 * アプリ初回表示時のみ: 全セグメント点灯(300ms)→ 消灯 → READY 表示。
 * 1回きり。localStorage 不可のためモジュールスコープの React state で管理。
 */

let hasBooted = false;

type Phase = "all" | "off" | "ready" | "out" | "done";

export function BootSequence() {
  const [phase, setPhase] = useState<Phase>(hasBooted ? "done" : "all");

  useEffect(() => {
    if (hasBooted) return;
    hasBooted = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("done");
      return;
    }
    const timers = [
      setTimeout(() => setPhase("off"), 300),
      setTimeout(() => setPhase("ready"), 480),
      setTimeout(() => setPhase("out"), 1150),
      setTimeout(() => setPhase("done"), 1350),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  if (phase === "done") return null;

  return (
    <div
      className={`boot-overlay${phase === "out" ? " boot-out" : ""}`}
      aria-hidden
    >
      <SegmentDisplay
        value={phase === "ready" || phase === "out" ? "READY" : "     "}
        allLit={phase === "all"}
        color="amber"
        cellHeight={48}
        chars={5}
        noFlicker
      />
    </div>
  );
}
