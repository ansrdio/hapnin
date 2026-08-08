import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1B0A2A",       // ground — deep aubergine-night
        plum: "#2C1342",      // raised surface
        "plum-hi": "#3A1B55", // hover / border on plum
        gold: "#F4B24C",      // primary accent — party light
        "gold-hi": "#FFD684", // gold highlight
        coral: "#F2593F",     // secondary — flyer misregistration, live
        emerald: "#159A6B",   // tertiary, used sparingly
        cream: "#F6EEE1",     // warm off-white type
        "mauve-dim": "#C9B2C4",// muted secondary text
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      maxWidth: {
        page: "68rem",
      },
    },
  },
  plugins: [],
};

export default config;
