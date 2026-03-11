/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#060816",
        neon: "#65f6c6",
        gold: "#f8d87f",
        coral: "#ff7f66",
        steel: "#8ca1c0"
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(101, 246, 198, 0.15), 0 24px 80px rgba(3, 6, 20, 0.45)"
      },
      backgroundImage: {
        "hero-grid":
          "radial-gradient(circle at top left, rgba(101, 246, 198, 0.22), transparent 32%), radial-gradient(circle at top right, rgba(248, 216, 127, 0.18), transparent 28%), linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 45%)"
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        body: ["Manrope", "sans-serif"]
      }
    }
  },
  plugins: []
};

