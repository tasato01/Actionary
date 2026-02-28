import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Actionary | Premium English-Japanese Dictionary",
  description: "Explore the depths of words and idioms with Actionary.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className="antialiased font-sans flex flex-col min-h-screen">
        {children}
      </body>
    </html>
  );
}
