import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand — warm orange
        brand: {
          50:  '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',  // primary
          600: '#ea6c0a',
          700: '#c2570a',
          800: '#9a3d07',
          900: '#7c3207',
        },
        // Status — light mode
        status: {
          open:   '#15803d',  // green-700  — 5.9:1 on white
          full:   '#b45309',  // amber-700  — 5.1:1 on white
          closed: '#b91c1c',  // red-700    — 5.8:1 on white
        },
        // Priority
        priority: {
          critical: '#7f1d1d',
          high:     '#991b1b',
          medium:   '#92400e',
          low:      '#1e3a5f',
        },
        // Surfaces — light
        surface: {
          DEFAULT: '#ffffff',
          muted:   '#fdf8f2',   // warm off-white
          subtle:  '#fef3e2',   // warm tint
          border:  '#e8d5c0',   // warm gray border
        },
        // Text — light
        text: {
          DEFAULT: '#1c1410',   // warm near-black
          muted:   '#44342a',   // warm dark brown
          subtle:  '#7a6055',   // warm medium
          faint:   '#b09080',   // warm light
        },
        // Dark mode surfaces
        dark: {
          bg:       '#141210',
          surface:  '#1e1a16',
          elevated: '#272219',
          border:   '#3a3028',
          text:     '#f0e8df',
          muted:    '#c4b0a0',
          subtle:   '#8a7060',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        base: ['1rem', { lineHeight: '1.6' }],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      boxShadow: {
        'card':      '0 1px 3px rgba(28,20,16,0.06), 0 4px 12px rgba(28,20,16,0.04)',
        'card-hover':'0 4px 16px rgba(249,115,22,0.12), 0 1px 4px rgba(28,20,16,0.08)',
        'card-dark': '0 1px 3px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.2)',
        'card-dark-hover': '0 4px 20px rgba(194,97,30,0.2), 0 1px 4px rgba(0,0,0,0.3)',
        'panel':     '0 20px 60px rgba(28,20,16,0.15), 0 4px 16px rgba(28,20,16,0.08)',
        'panel-dark':'0 20px 60px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.3)',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'enter':  'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        shimmer: 'shimmer 2s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
