/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brew: {
          bg: '#faf7f2',
          surface: '#f2ece0',
          card: '#ffffff',
          border: '#e5ddd0',
          primary: '#5a3820',
          'primary-light': '#8b5a32',
          'primary-dark': '#3a2010',
          text: '#1c1510',
          muted: '#6b5040',
          faint: '#a8907c',
          positive: '#2d6e4e',
          negative: '#9b3328',
          amber: '#b87d28',
          gold: '#b8920a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Georgia', 'Times New Roman', 'serif'],
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(90,56,32,0.06), 0 1px 2px rgba(90,56,32,0.04)',
        'card-hover': '0 4px 12px rgba(90,56,32,0.10), 0 2px 4px rgba(90,56,32,0.06)',
      },
    },
  },
  plugins: [],
}
