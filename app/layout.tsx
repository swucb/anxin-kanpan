import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "安心看盘｜A 股行情与行业对比",
    template: "%s｜安心看盘",
  },
  description: "面向家庭投资爱好者，免登录查看 A 股行情、企业财务、行业公司对比和美股行业参考。",
  applicationName: "安心看盘",
  openGraph: {
    title: "安心看盘｜A 股行情与行业对比",
    description: "面向家庭投资爱好者的 A 股行情、企业财务、行业公司对比和美股行业参考。",
    type: "website",
    locale: "zh_CN",
  },
  twitter: {
    card: "summary_large_image",
    title: "安心看盘｜A 股行情与行业对比",
    description: "面向家庭投资爱好者的 A 股行情、企业财务、行业公司对比和美股行业参考。",
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
