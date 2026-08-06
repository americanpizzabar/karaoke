"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { clearLocalData, useAppStore } from "@/store/useAppStore";

export default function SettingsPage() {
  const router = useRouter();
  const invalidate = useAppStore((s) => s.invalidateRange);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const deleteAll = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      // 端末内保存(サーバー未接続時のフォールバック分)はどちらでも削除する
      clearLocalData();
      invalidate();
      if (res.ok) {
        setMessage("すべてのデータを削除しました。");
      } else {
        setMessage(
          "この端末内のデータを削除しました(サーバー未接続のため、サーバー側は未削除の可能性があります)。"
        );
      }
      setConfirming(false);
      setTimeout(() => router.push("/"), 1400);
    } catch {
      clearLocalData();
      invalidate();
      setMessage("この端末内のデータを削除しました(オフライン)。");
      setConfirming(false);
      setTimeout(() => router.push("/"), 1400);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main>
      <div className="etch-label" style={{ margin: "4px 0 14px" }}>
        SETUP
      </div>
      <h1 className="page-title">設定</h1>

      <section className="card">
        <div className="section-label" style={{ marginTop: 0 }}>
          ACCOUNT
        </div>
        <p className="muted">
          現在は匿名ユーザーとして利用中です。データはこの端末(ブラウザ)に
          紐づいています。メール/ソーシャルログインによる引き継ぎは今後対応予定です。
        </p>
      </section>

      <section className="card">
        <div className="section-label" style={{ marginTop: 0 }}>
          PRIVACY
        </div>
        <p className="muted">
          音声はすべて端末内で処理され、サーバーには送信されません。保存されるのは
          測定した音名(MIDIノート番号)とトレーニング結果のみです。
        </p>
      </section>

      <section className="card">
        <div className="section-label" style={{ marginTop: 0 }}>
          DATA
        </div>
        <p className="muted" style={{ marginBottom: 12 }}>
          測定履歴・トレーニングログを含むすべてのデータを削除します。この操作は取り消せません。
        </p>
        {!confirming ? (
          <button
            className="btn btn-block btn-danger"
            onClick={() => setConfirming(true)}
          >
            すべてのデータを削除
          </button>
        ) : (
          <div className="grid-2">
            <button
              className="btn btn-danger"
              onClick={deleteAll}
              disabled={deleting}
            >
              {deleting ? "削除中..." : "本当に削除する"}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => setConfirming(false)}
              disabled={deleting}
            >
              キャンセル
            </button>
          </div>
        )}
        {message && (
          <p className="muted" style={{ marginTop: 10 }}>
            {message}
          </p>
        )}
      </section>

      <p className="muted" style={{ fontSize: 11 }}>
        音域アタック v0.1.0(MVP)— 曲データは参考値です。
      </p>
    </main>
  );
}
