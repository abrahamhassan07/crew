import type { Metadata } from "next";
import { Karla, Spectral } from "next/font/google";
import "./globals.css";

const karla = Karla({
  variable: "--font-karla",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const spectral = Spectral({
  variable: "--font-spectral",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Crew & Grounds",
  description: "Scheduling and job tracking for Crew & Grounds",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${karla.variable} ${spectral.variable} h-full`}>
      <body className="min-h-full font-sans antialiased bg-bg text-ink">{children}</body>
    </html>
  );
}
