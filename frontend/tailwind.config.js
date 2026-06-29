/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Enable dark mode
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#0f172a',
          800: '#1e293b',
          700: '#334155',
        },
        primary: {
          500: '#3b82f6',
          400: '#60a5fa',
        },
        neon: {
          blue: '#00f3ff',
          purple: '#bc13fe',
        }
      },
      animation: {
        'glow-border': 'glow-border 3s ease-in-out infinite alternate',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        'glow-border': {
          '0%': { boxShadow: '0 0 5px #00f3ff, inset 0 0 2px #00f3ff' },
          '100%': { boxShadow: '0 0 15px #bc13fe, inset 0 0 5px #bc13fe' },
        }
      }
    },
  },
  plugins: [],
}
