import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0f17",
        card: "#11161f",
        card2: "#161c28",
        line: "#232b3a",
        accent: "#4f8cff",
        ok: "#34d399",
        warn: "#fbbf24",
        danger: "#f87171",
        muted: "#8b94a7",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
