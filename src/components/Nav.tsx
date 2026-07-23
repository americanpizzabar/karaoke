"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", icon: "⌂", label: "ホーム" },
  { href: "/measure", icon: "🎤", label: "測定" },
  { href: "/songs", icon: "🎵", label: "曲攻略" },
  { href: "/training", icon: "🔥", label: "トレ" },
  { href: "/progress", icon: "📈", label: "進捗" },
];

export function Nav() {
  const pathname = usePathname();
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
            <span className="tab-icon" aria-hidden>
              {t.icon}
            </span>
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
