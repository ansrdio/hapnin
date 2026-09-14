import { Manrope } from "next/font/google";

// UI and heading face. Clash Display (the brand face) stays for the big
// marketing headlines only — at button, label and card-title sizes its quirky
// letterforms were hard to read (an organizer told us it read "dyslexic").
// Manrope has open apertures, distinct letterforms and real weights.
export const displayFont = Manrope({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});
