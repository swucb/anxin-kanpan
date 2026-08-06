import type { Metadata } from "next";
import { MarketCompanion } from "./MarketCompanion";

export const metadata: Metadata = {
  title: "安心看盘｜行业资讯与美股参照",
  description: "面向家庭投资爱好者，免登录阅读产业新闻、企业财报、资金变化与美股行业参照。",
};

export default function Home() {
  return <MarketCompanion />;
}
