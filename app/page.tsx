import type { Metadata } from "next";
import { MarketCompanion } from "./MarketCompanion";

export const metadata: Metadata = {
  title: "安心看盘｜A 股行情与行业对比",
  description: "免登录查看 A 股行情、企业财务、行业公司对比和美股行业参考。",
};

export default function Home() {
  return <MarketCompanion />;
}
