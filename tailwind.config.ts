import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // HTH brand palette — hot pink + black + neon court accents
        hot: {
          50: '#fff0f8',
          100: '#ffd6ec',
          200: '#ffadd8',
          300: '#ff7ebe',
          400: '#ff4aa4',
          500: '#ff1f8f',
          600: '#e80f7a',
          700: '#b80a60',
          800: '#80073f',
          900: '#4d0426',
        },
        court: {
          ball: '#d8f24a',
          line: '#ffffff',
          surface: '#ff2a91',
        },
        ink: {
          DEFAULT: '#0a0a0a',
          soft: '#171717',
          line: '#262626',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'cursive'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 30px rgba(255, 31, 143, 0.45)',
        'glow-sm': '0 0 12px rgba(255, 31, 143, 0.45)',
      },
      backgroundImage: {
        'neon-radial':
          'radial-gradient(ellipse at top, rgba(255,31,143,0.35), transparent 60%)',
      },
    },
  },
  plugins: [],
};

export default config;
