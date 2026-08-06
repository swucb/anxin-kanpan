import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://swucb.github.io"),
  title: {
    default: "安心看盘｜行业资讯与美股参照",
    template: "%s｜安心看盘",
  },
  description: "免登录阅读产业新闻、企业财报、资金变化与美股行业参照，每日整理上一完整交易日。",
  applicationName: "安心看盘",
  alternates: { canonical: "/anxin-kanpan/" },
  openGraph: {
    title: "安心看盘｜行业资讯与美股参照",
    description: "产业新闻、企业财报、资金变化与美股行业参照，每日整理上一完整交易日。",
    type: "website",
    locale: "zh_CN",
    siteName: "安心看盘",
    url: "/anxin-kanpan/",
    images: [
      {
        url: "/anxin-kanpan/share-cover.png",
        width: 1200,
        height: 630,
        alt: "安心看盘｜行业资讯与美股参照",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "安心看盘｜行业资讯与美股参照",
    description: "产业新闻、企业财报、资金变化与美股行业参照，每日整理上一完整交易日。",
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
