/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        vale: {
          bg: '#2c2151',
          surface: '#231b44',
          card: '#1e1740',
          border: '#3a2d6b',
          // Accent palette
          pink: '#e5b2e6',
          cyan: '#34bed6',
          blue: '#164291',
          mint: '#77e6c5',
          purple: '#711ea6',
          // Semantic aliases
          accent: '#e5b2e6',
          secondary: '#34bed6',
          growth: '#77e6c5',
          deep: '#164291',
          shadow: '#711ea6',
          text: '#e8e0f0',
          muted: '#a090c0',
          // Lincoln & Arden
          lincoln: '#77e6c5',
          arden: '#e5b2e6',
        },
        // Keep hearth as alias for backwards compat during transition
        hearth: {
          bg: '#2c2151',
          surface: '#231b44',
          card: '#1e1740',
          border: '#3a2d6b',
          accent: '#e5b2e6',
          ember: '#34bed6',
          growth: '#77e6c5',
          shadow: '#711ea6',
          star: '#164291',
          text: '#e8e0f0',
          muted: '#a090c0',
        }
      },
      fontFamily: {
        sans: ['"Unica One"', 'Inter', 'sans-serif'],
        display: ['"Unica One"', 'sans-serif'],
        mystery: ['"Playfair Display"', 'serif'],
      },
      animation: {
        fade: 'fadeIn 0.3s ease-in',
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}
