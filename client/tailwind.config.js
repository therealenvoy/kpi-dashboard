/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0C0A09",
        "ink-deep": "#080706",
        "ink-card": "#1C1917",
        neon: "#65f6c6",
        gold: "#A16207",
        "gold-light": "#D4A853",
        coral: "#ff7f66",
        steel: "#78716C",
        stone: { 800: "#292524", 700: "#44403C", 600: "#57534E" }
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(161, 98, 7, 0.15), 0 24px 80px rgba(3, 6, 20, 0.45)",
        "card-hover": "0 0 0 1px rgba(255, 255, 255, 0.08), 0 8px 24px rgba(0, 0, 0, 0.2)"
      },
      backgroundImage: {
        "hero-grid":
          "radial-gradient(circle at top left, rgba(161, 98, 7, 0.12), transparent 32%), radial-gradient(circle at top right, rgba(34, 197, 94, 0.08), transparent 28%), linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 45%)"
      },
      fontFamily: {
        display: ["Outfit", "sans-serif"],
        body: ["Work Sans", "sans-serif"]
      },
      keyframes: {
        "fade-in": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "bar-grow": { from: { width: "0%" }, to: {} }
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out forwards",
        "fade-in-delay": "fade-in 0.4s ease-out 0.15s forwards"
      }
    }
  },
  plugins: []
};

