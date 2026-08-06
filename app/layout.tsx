import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "安心看盘｜把复杂的 A 股说得明白",
    template: "%s｜安心看盘",
  },
  description: "长辈也能轻松使用的 A 股行情、企业分析、行业观察与同业比较工具。",
  applicationName: "安心看盘",
  openGraph: {
    title: "安心看盘｜把复杂的 A 股说得明白",
    description: "每日行情、企业优劣、行业形势和同业比较，一眼看明白。",
    type: "website",
    locale: "zh_CN",
  },
  twitter: {
    card: "summary_large_image",
    title: "安心看盘｜把复杂的 A 股说得明白",
    description: "每日行情、企业优劣、行业形势和同业比较，一眼看明白。",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
