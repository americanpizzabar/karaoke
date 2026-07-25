/** 画面遷移: 120msのopacityのみ。動きで飾らない(仕様書 5章) */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-fade">{children}</div>;
}
