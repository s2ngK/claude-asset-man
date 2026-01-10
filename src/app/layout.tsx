import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI 가계부 - 우리 그룹 자산 관리",
  description: "영수증 스캔과 AI 분석으로 관리하는 똑똑한 가계부",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AI 가계부",
  },
};

export const viewport: Viewport = {
  themeColor: "#13eca4",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased selection:bg-emerald-100 dark:selection:bg-emerald-900/30`}
      >
        {children}
      </body>
    </html>
  );
}
