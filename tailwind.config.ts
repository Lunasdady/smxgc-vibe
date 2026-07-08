import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        apple: {
          bg: '#F5F5F7',
          card: 'rgba(255, 255, 255, 0.72)',
          cardSolid: '#FFFFFF',
          border: 'rgba(0, 0, 0, 0.08)',
          text: '#1D1D1F',
          textSecondary: '#86868B',
          textTertiary: '#A1A1A6',
          blue: '#0071E3',
          blueHover: '#0077ED',
          blueLight: '#E8F4FD',
        },
        dark: {
          bg: '#F5F5F7',
          card: 'rgba(255, 255, 255, 0.72)',
          cardHover: '#FFFFFF',
          border: 'rgba(0, 0, 0, 0.08)',
          text: '#1D1D1F',
          textMuted: '#86868B',
          textDim: '#A1A1A6',
        },
        positive: '#DC2626',
        negative: '#16A34A',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro SC"', '"SF Pro Text"', '"Helvetica Neue"', 'Helvetica', '"PingFang SC"', '"Hiragino Sans GB"', '"Microsoft YaHei"', 'Arial', 'sans-serif'],
        mono: ['SF Mono', 'SFMono-Regular', 'ui-monospace', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      borderRadius: {
        '2xl': '18px',
        '3xl': '24px',
        '4xl': '32px',
      },
      boxShadow: {
        'apple': '0 4px 24px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
        'apple-hover': '0 12px 40px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.04)',
        'apple-lg': '0 20px 60px rgba(0, 0, 0, 0.1), 0 8px 20px rgba(0, 0, 0, 0.06)',
      },
      transitionTimingFunction: {
        'apple': 'cubic-bezier(0.25, 1, 0.5, 1)',
      },
      backdropBlur: {
        'apple': '20px',
      },
    },
  },
  plugins: [],
};
export default config;
