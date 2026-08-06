import type { Metadata } from "next";
import { MarketCompanion } from "./MarketCompanion";

export const metadata: Metadata = {
  title: "安心看盘｜把复杂的 A 股说得明白",
  description: "长辈也能轻松使用的 A 股行情、企业分析、行业观察与同业比较工具。",
};

export default function Home() {
  return <MarketCompanion />;
}
