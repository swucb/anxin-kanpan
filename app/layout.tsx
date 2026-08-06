import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://swucb.github.io"),
  title: {
    default: "安心看盘｜一起看懂行业与市场",
    template: "%s｜安心看盘",
  },
  description: "免登录查看 A 股行情、企业财务、行业对比、资金动向和美股行业参考。",
  applicationName: "安心看盘",
  alternates: { canonical: "/anxin-kanpan/" },
  openGraph: {
    title: "安心看盘｜一起看懂行业与市场",
    description: "A 股行情、企业财务、行业对比、资金动向和美股行业参考，每日更新。",
    type: "website",
    locale: "zh_CN",
    siteName: "安心看盘",
    url: "/anxin-kanpan/",
    images: [
      {
        url: "/anxin-kanpan/share-cover.png",
        width: 1200,
        height: 630,
        alt: "安心看盘｜一起看懂行业与市场",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "安心看盘｜一起看懂行业与市场",
    description: "A 股行情、企业财务、行业对比、资金动向和美股行业参考，每日更新。",
    images: ["/anxin-kanpan/share-cover.png"],
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
