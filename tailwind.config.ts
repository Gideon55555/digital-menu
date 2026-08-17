import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './components/**/*.{js,ts,jsx,tsx}',
    './app/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          50: '#faf8f3',
          100: '#f5f1e8',
          200: '#ebe5d9',
          300: '#d4c5a9',
          400: '#c9b896',
          500: '#b8a876',
          600: '#a89958',
          700: '#8b7a45',
          800: '#6d6037',
          900: '#53482c',
        },
        cream: {
          50: '#fefdfb',
          100: '#fffbf7',
          200: '#fef9f3',
          300: '#fdf3e8',
          400: '#f9ead5',
          500: '#f0dcc0',
        },
        restaurant: {
          bg: '#f5f1e8',
          'bg-dark': '#1a1410',
          text: '#3d3220',
          'text-light': '#8b7765',
          accent: '#a89958',
          'accent-dark': '#c9b896',
        },
      },
      fontFamily: {
        sans: ['system-ui', 'sans-serif'],
        serif: ['Georgia', 'serif'],
      },
      fontSize: {
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem',
        '5xl': '3rem',
      },
      spacing: {
        safe: 'max(1rem, env(safe-area-inset-left))',
        'safe-right': 'max(1rem, env(safe-area-inset-right))',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
  darkMode: 'class',
}
export default config
