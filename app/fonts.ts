import { Plus_Jakarta_Sans, Fraunces } from "next/font/google";

// Two faces, chosen after an organizer found the old display face hard to
// read:
//   Plus Jakarta Sans — every button, label, form, paragraph and UI heading.
//     Open letterforms, a two-storey "a", real weights. One family, one voice.
//   Fraunces — the big statements and the big numbers only: hero headlines,
//     pitch slides, dashboard stats. Warm, editorial, unmistakably Hapnin.
export const sansFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

export const serifFont = Fraunces({
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
  variable: "--font-serif",
  display: "swap",
});
