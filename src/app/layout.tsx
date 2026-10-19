import type { Metadata } from "next";
import { Figtree, Karla, Spectral } from "next/font/google";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

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
  metadataBase: new URL("https://www.crewandgrounds.com"),
  title: "Crew & Grounds",
  description: "Scheduling, reminders, quotes and invoicing for Australian gardening, lawn care, cleaning and property maintenance businesses.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${figtree.variable} ${karla.variable} ${spectral.variable} h-full`}>
      <body className="min-h-full font-sans antialiased bg-page-bg text-ink-primary">{children}</body>
    </html>
  );
}
