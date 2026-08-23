import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "kaizhuo-mahjong.hao10d.chatgpt.site";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const image = new URL("/og.png", origin).toString();
  const description = "記錄每場家庭麻將的輸贏金額，自動統計勝率、排名、平均輸贏與胡牌表現。";

  return {
    title: "張麻館｜家庭麻將輸贏統計",
    description,
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "張麻館",
      description,
      url: origin,
      siteName: "張麻館",
      locale: "zh_TW",
      type: "website",
      images: [{ url: image, width: 1536, height: 1024, alt: "張麻館家庭麻將帳本" }],
    },
    twitter: { card: "summary_large_image", title: "張麻館", description, images: [image] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-Hant"><body>{children}</body></html>;
}
