/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  corePlugins: {
    preflight: false
  },
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#ecfeff",
          100: "#cffafe",
          200: "#a5f3fc",
          300: "#67e8f9",
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
          700: "#0e7490",
          800: "#155e75",
          900: "#164e63"
        },
        glossy: {
          white: "#ffffff",
          bright: "#f9fbfd",
          pearl: "#fafbfc",
          cream: "#fbfdfe",
          shine: "#fdfdfe"
        }
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(34,211,238,.18), 0 22px 45px rgba(6, 24, 39, .25)",
        "glossy-sm": "0 2px 8px rgba(24, 119, 217, 0.06), 0 1px 2px rgba(0, 0, 0, 0.03)",
        "glossy-md": "0 6px 20px rgba(24, 119, 217, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)",
        "glossy-lg": "0 12px 32px rgba(24, 119, 217, 0.12), 0 4px 8px rgba(0, 0, 0, 0.06)",
        "glossy-xl": "0 20px 44px rgba(24, 119, 217, 0.14), 0 8px 16px rgba(0, 0, 0, 0.08)",
        "glossy-hover": "0 24px 52px rgba(24, 119, 217, 0.18), 0 12px 20px rgba(0, 0, 0, 0.1)",
        "inner-glossy": "inset 0 0 0 1px rgba(255, 255, 255, 0.8), inset 0 1px 3px rgba(255, 255, 255, 0.4)"
      },
      backdropBlur: {
        xs: "2px",
        sm: "4px",
        md: "8px",
        lg: "12px",
        xl: "16px"
      }
    }
  },
  plugins: []
};

