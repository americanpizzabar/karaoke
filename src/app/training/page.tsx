"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePitchDetector } from "@/hooks/usePitchDetector";
import { midiToFreq, midiToKaraoke } from "@/lib/notes";
import { fetchRangeHistory, useAppStore } from "@/store/useAppStore";

type MenuKey = "liproll" | "longtone" | "challenge" | "falsetto_slide";

interface MenuDef {
  key: MenuKey;
  title: string;
  desc: string;
  target: (chestLow: number, chestHigh: number) => number;
  targetLabel: string;
}

// ターゲット音は常に現在の音域データから動的に算出(仕様 2.3.1)
const MENUS: MenuDef[] = [
  {
    key: "liproll",
    title: "リップロール上昇",
    desc: "半音ずつ上がるガイド音に合わせてリップロール(唇プルプル)で発声",
    target: (lo, hi) => Math.min(lo + 7, hi - 1),
    targetLabel: "開始音",
  },
  {
    key: "longtone",
    title: "ロングトーン",
    desc: "地声最高音−2半音を5秒キープ。音程のブレを測定します",
    target: (_lo, hi) => hi - 2,
    targetLabel: "ターゲット",
  },
  {
    key: "challenge",
    title: "限界チャレンジ",
    desc: "地声最高音+1半音に挑戦。到達すると音域記録が更新されます",
    target: (_lo, hi) => hi + 1,
    targetLabel: "ターゲット",
  },
  {
    key: "falsetto_slide",
    title: "裏声スライド",
    desc: "mid2域から裏声へスルッと切り替える練習。高い声が出ればOK",
    target: (_lo, hi) => hi + 3,
    targetLabel: "目標域",
  },
];

export default function TrainingPage() {
  const latest = useAppStore((s) => s.latestRange);
  const [loaded, setLoaded] = useState(false);
  const [activeMenu, setActiveMenu] = useState<MenuDef | null>(null);

  useEffect(() => {
    fetchRangeHistory()
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const chestLow = latest?.chestLow ?? null;
  const chestHigh = latest?.chestHigh ?? null;

  if (activeMenu && chestLow !== null && chestHigh !== null) {
    return (
      <TrainingSession
        menu={activeMenu}
        chestLow={chestLow}
        chestHigh={chestHigh}
        onExit={() => setActiveMenu(null)}
      />
    );
  }

  return (
    <main>
      <h1 className="page-title">トレーニング</h1>
      <p className="muted" style={{ marginBottom: 14 }}>
        1回3分。あなたの音域データに合わせたメニューです。
      </p>

      {chestHigh === null ? (
        <section className="card">
          <p>
            トレーニングには音域データが必要です。
            <Link href="/measure" style={{ color: "var(--accent)" }}>
              まず音域を測定
            </Link>
            してください。
          </p>
          {!loaded && <p className="muted">読み込み中...</p>}
        </section>
      ) : (
        MENUS.map((m) => {
          const target = m.target(chestLow ?? chestHigh - 12, chestHigh);
          return (
            <section key={m.key} className="card">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div>
                  <strong>{m.title}</strong>
                  <p className="muted" style={{ marginTop: 2 }}>
                    {m.desc}
                  </p>
                  <p className="led" style={{ marginTop: 6, color: "var(--chest)" }}>
                    {m.targetLabel}: {midiToKaraoke(target)}
                  </p>
                </div>
                <button
                  className="btn btn-accent"
                  onClick={() => setActiveMenu(m)}
                >
                  開始
                </button>
              </div>
            </section>
          );
        })
      )}

      <p className="muted" style={{ fontSize: 11 }}>
        ※ 医学的・専門的判定ではありません。喉に痛みや違和感を感じたらすぐに中止してください。
      </p>
    </main>
  );
}

type SessionStatus = "ready" | "running" | "done";

function TrainingSession({
  menu,
  chestLow,
  chestHigh,
  onExit,
}: {
  menu: MenuDef;
  chestLow: number;
  chestHigh: number;
  onExit: () => void;
}) {
  const { state, active, error, start, stop, getAudioContext } = usePitchDetector();
  const [status, setStatus] = useState<SessionStatus>("ready");
  const [message, setMessage] = useState("");
  const [outcome, setOutcome] = useState<{
    achieved: boolean;
    stabilityCents?: number;
    detail: string;
  } | null>(null);

  const target = menu.target(chestLow, chestHigh);
  const stateRef = useRef(state);
  stateRef.current = state;
  const stopRef = useRef(stop);
  stopRef.current = stop;
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
      stopRef.current();
    };
  }, []);

  const playTone = (midi: number, durMs: number) => {
    const ctx = getAudioContext();
    if (!ctx) return Promise.resolve();
    // ガイド音はOscillatorNodeで生成(音源ファイル不要)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = midiToFreq(midi);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durMs / 1000);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durMs / 1000 + 0.05);
    return new Promise<void>((r) => setTimeout(r, durMs));
  };

  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  /** 一定時間ピッチをサンプリングして midi float の配列を返す */
  const capture = async (ms: number): Promise<number[]> => {
    const samples: number[] = [];
    const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      if (cancelledRef.current) break;
      const m = stateRef.current.midi;
      if (m !== null) samples.push(m);
      await wait(50);
    }
    return samples;
  };

  const saveLog = async (achieved: boolean, stabilityCents?: number) => {
    await fetch("/api/training", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        menu: menu.key,
        targetNote: target,
        achieved,
        stabilityCents: stabilityCents ?? null,
      }),
    }).catch(() => {});
  };

  const updateRangeRecord = async (newChestHigh: number) => {
    const latest = useAppStore.getState().latestRange;
    await fetch("/api/range", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chestLow: latest?.chestLow ?? null,
        chestHigh: newChestHigh,
        falsettoHigh: latest?.falsettoHigh ?? null,
      }),
    }).catch(() => {});
    useAppStore.getState().invalidateRange();
    fetchRangeHistory(true).catch(() => {});
  };

  const run = async () => {
    if (!active) {
      await start();
    }
    setStatus("running");
    setOutcome(null);

    if (menu.key === "liproll") {
      const startNote = Math.min(chestLow + 7, chestHigh - 1);
      const endNote = Math.max(startNote, chestHigh - 1);
      const notes: number[] = [];
      for (let n = startNote; n <= endNote && notes.length < 8; n++) notes.push(n);
      let hits = 0;
      for (const n of notes) {
        if (cancelledRef.current) return;
        setMessage(`ガイド音: ${midiToKaraoke(n)} — 続けて同じ高さで発声`);
        await playTone(n, 700);
        const samples = await capture(1200);
        const ok =
          samples.filter((m) => Math.abs(m - n) * 100 <= 70).length >=
          Math.max(3, samples.length * 0.4);
        if (ok) hits++;
      }
      const rate = notes.length ? hits / notes.length : 0;
      const achieved = rate >= 0.6;
      await saveLog(achieved);
      setOutcome({
        achieved,
        detail: `ピッチ追従率 ${(rate * 100).toFixed(0)}%(${hits}/${notes.length}音)`,
      });
    }

    if (menu.key === "longtone") {
      setMessage(`ガイド音を聞いて ${midiToKaraoke(target)} を5秒キープ`);
      await playTone(target, 1000);
      await wait(300);
      setMessage(`発声中… ${midiToKaraoke(target)} をキープ!`);
      const samples = await capture(5000);
      const cents = samples.map((m) => (m - target) * 100).filter((c) => Math.abs(c) < 300);
      let achieved = false;
      let stability: number | undefined;
      if (cents.length >= 10) {
        const mean = cents.reduce((a, b) => a + b, 0) / cents.length;
        stability = Math.sqrt(
          cents.reduce((a, c) => a + (c - mean) * (c - mean), 0) / cents.length
        );
        achieved = stability <= 35;
      }
      await saveLog(achieved, stability);
      setOutcome({
        achieved,
        stabilityCents: stability,
        detail:
          stability !== undefined
            ? `安定度: ±${stability.toFixed(0)}セント(35以内でクリア)`
            : "声を検出できませんでした。マイクとの距離を調整してください。",
      });
    }

    if (menu.key === "challenge") {
      setMessage(`ガイド音を聞いて ${midiToKaraoke(target)} に挑戦!(15秒)`);
      await playTone(target, 1000);
      await wait(300);
      const t0 = performance.now();
      let heldStart: number | null = null;
      let achieved = false;
      while (performance.now() - t0 < 15000) {
        if (cancelledRef.current) return;
        const m = stateRef.current.midi;
        if (m !== null && Math.round(m) >= target) {
          if (heldStart === null) heldStart = performance.now();
          if (performance.now() - heldStart >= 1000) {
            achieved = true;
            break;
          }
        } else {
          heldStart = null;
        }
        setMessage(
          `${midiToKaraoke(target)} を1秒キープで達成!(残り${Math.ceil(
            (15000 - (performance.now() - t0)) / 1000
          )}秒)`
        );
        await wait(50);
      }
      await saveLog(achieved);
      if (achieved) {
        await updateRangeRecord(target);
      }
      setOutcome({
        achieved,
        detail: achieved
          ? `${midiToKaraoke(target)} に到達!音域記録を更新しました 🎉`
          : "今回は届きませんでした。リップロールで温めてから再挑戦を。",
      });
    }

    if (menu.key === "falsetto_slide") {
      const slideStart = Math.min(64, chestHigh - 2); // mid2域
      setMessage(
        `${midiToKaraoke(slideStart)} から上へ、裏声でスーッとスライド(10秒)`
      );
      await playTone(slideStart, 800);
      const t0 = performance.now();
      let heldStart: number | null = null;
      let achieved = false;
      let maxMidi = 0;
      while (performance.now() - t0 < 10000) {
        if (cancelledRef.current) return;
        const m = stateRef.current.midi;
        if (m !== null) {
          maxMidi = Math.max(maxMidi, m);
          if (m >= chestHigh + 2) {
            if (heldStart === null) heldStart = performance.now();
            if (performance.now() - heldStart >= 500) {
              achieved = true;
              break;
            }
          } else {
            heldStart = null;
          }
        }
        await wait(50);
      }
      await saveLog(achieved);
      setOutcome({
        achieved,
        detail: achieved
          ? `裏声域(${midiToKaraoke(Math.round(maxMidi))})を検出!`
          : "地声域より上の音を検出できませんでした。力を抜いてもう一度。",
      });
    }

    setStatus("done");
    setMessage("");
  };

  return (
    <main>
      <h1 className="page-title">{menu.title}</h1>
      <section className="card">
        <p className="muted">{menu.desc}</p>
        <p className="led" style={{ marginTop: 8, color: "var(--chest)" }}>
          {menu.targetLabel}: {midiToKaraoke(target)}
        </p>
      </section>

      {error && (
        <section className="card">
          <p className="warn">{error}</p>
        </section>
      )}

      <section className="card" aria-live="polite">
        {status === "ready" && (
          <button className="btn btn-accent btn-block" onClick={run}>
            {active ? "スタート" : "マイクを許可してスタート"}
          </button>
        )}
        {status === "running" && (
          <>
            <p style={{ minHeight: 44 }}>{message}</p>
            <div className="note-display">
              {state.midi !== null ? midiToKaraoke(Math.round(state.midi)) : "‥‥"}
            </div>
          </>
        )}
        {status === "done" && outcome && (
          <>
            <p
              className="led"
              style={{
                fontSize: 22,
                color: outcome.achieved ? "var(--chest)" : "var(--muted)",
              }}
            >
              {outcome.achieved ? "CLEAR!" : "MISS…"}
            </p>
            <p style={{ marginTop: 6 }}>{outcome.detail}</p>
            <button
              className="btn btn-accent btn-block"
              style={{ marginTop: 12 }}
              onClick={run}
            >
              もう一度
            </button>
          </>
        )}
      </section>

      <button
        className="btn btn-ghost btn-block"
        onClick={() => {
          stop();
          onExit();
        }}
      >
        ← メニューに戻る
      </button>
      <p className="muted" style={{ fontSize: 11, marginTop: 10 }}>
        喉に痛みを感じたらすぐに中止してください。
      </p>
    </main>
  );
}
