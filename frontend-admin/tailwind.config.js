/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // RoseNet design-system tokens (matrix-pink dark theme)
        brand: {
          DEFAULT: '#F44174',
          strong: '#FF5A89',
          soft: '#3D0E1F',
          softer: '#1A0810',
        },
        neutral: {
          primary: '#050505',
          soft: '#0A0A0A',
          medium: '#111111',
          strong: '#1A1A1A',
        },
        success: { DEFAULT: '#00CC88', strong: '#009966', soft: '#061A14' },
        danger: { DEFAULT: '#FF3355', strong: '#CC2244', soft: '#1A0508' },
        warning: { DEFAULT: '#FF8833' },
        heading: '#EDEDED',
        body: '#888888',
        subtle: '#666666',
        line: { DEFAULT: '#1A1A1A', medium: '#222222', strong: '#333333' },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'sans-serif'],
      },
      borderRadius: {
        base: '12px',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 300ms cubic-bezier(0.16, 1, 0.3, 1)',
        pulseGlow: 'pulseGlow 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
