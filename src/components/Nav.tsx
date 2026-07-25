"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "ホーム" },
  { href: "/measure", label: "測定" },
  { href: "/songs", label: "曲攻略" },
  { href: "/training", label: "トレ" },
  { href: "/progress", label: "進捗" },
];

export function Nav() {
  const pathname = usePathname();
  // S2 測定画面はフェースプレート単体で構成(ナビは出さない)
  if (pathname === "/measure") return null;
  return (
    <nav className="tabbar" aria-label="メインナビゲーション">
      <div className="tabbar-inner">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`tab${pathname === t.href ? " active" : ""}`}
            aria-current={pathname === t.href ? "page" : undefined}
          >
            <span className="tab-led" aria-hidden />
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
