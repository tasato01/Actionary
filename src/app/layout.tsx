import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Actionaly | Premium English-Japanese Dictionary",
  description: "Explore the depths of words and idioms with Actionaly.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased bg-black min-h-screen text-white">
        {children}
      </body>
    </html>
  );
}
