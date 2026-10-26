import type { Metadata } from "next";
import { Fredoka, IBM_Plex_Mono, IBM_Plex_Sans, Noto_Sans_Kawi } from "next/font/google";
import "./globals.css";

// Fredoka: page and card titles only. Plex Sans: everything else. Plex Mono: code points, IDs. Noto Sans Kawi: every Kawi form.
const fredoka = Fredoka({ variable: "--ff-fredoka", subsets: ["latin"], weight: ["500", "600", "700"] });
const plexSans = IBM_Plex_Sans({ variable: "--ff-plex-sans", subsets: ["latin"], weight: ["400", "500", "600"] });
const plexMono = IBM_Plex_Mono({ variable: "--ff-plex-mono", subsets: ["latin"], weight: ["400", "500"] });
const kawi = Noto_Sans_Kawi({ variable: "--ff-kawi", subsets: ["kawi"], weight: "400" });

export const metadata: Metadata = {
  title: { default: "KawiQuest", template: "%s · KawiQuest" },
  description: "Statistics and data for KawiQuest, the game that teaches Filipino learners to write Kawi.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fredoka.variable} ${plexSans.variable} ${plexMono.variable} ${kawi.variable}`}>
      <body>{children}</body>
    </html>
  );
}
