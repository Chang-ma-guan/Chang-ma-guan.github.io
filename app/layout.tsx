import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "開桌｜台灣麻將入門誌",
  description: "從看懂牌、判斷進張，到真正坐上牌桌。用清楚的圖解與短練習，三十分鐘學會台灣麻將入門。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
