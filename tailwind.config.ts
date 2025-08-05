import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "*.{js,ts,jsx,tsx,mdx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Hardcoded colors for consistency
        "gray-900": "#111827",
        "gray-800": "#1F2937",
        "gray-700": "#374151",
        "gray-600": "#4B5563",
        "gray-500": "#6B7280",
        "gray-400": "#9CA3AF",
        "gray-300": "#D1D5DB",
        "gray-100": "#F3F4F6",
        "green-400": "#4ADE80",
        "green-500": "#22C55E",
        "green-700": "#047857",
        "green-900": "#064E40",
        "red-400": "#F87171",
        "red-500": "#EF4444",
        "red-700": "#B91C1C",
        "red-900": "#7F1D1D",
        "yellow-100": "#FEF3C7",
        "yellow-300": "#FCD34D",
        "yellow-400": "#FBBF24",
        "yellow-500": "#F59E0B",
        "yellow-700": "#B45309",
        "yellow-900": "#78350F",
        "blue-400": "#60A5FA",
        "blue-500": "#3B82F6",
        "blue-600": "#2563EB",
        "blue-700": "#1D4ED8",
        "blue-900": "#1E3A8A",
        "orange-400": "#FB923C",
        "orange-500": "#F97316",
        "purple-400": "#C084FC",
        "purple-900": "#581C87",
        // Shadcn default colors (from globals.css variables)
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
export default config
