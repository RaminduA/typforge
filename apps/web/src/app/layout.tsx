import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Typforge",
  description: "A Prism-style Typst editor and PDF compiler"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}