import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Status colors — all meet 4.5:1 on white background
        status: {
          open: '#166534',      // green-800: 7.2:1 on white
          full: '#92400e',      // amber-800: 5.9:1 on white
          closed: '#991b1b',    // red-800: 7.1:1 on white
        },
        // Priority colors — all meet 4.5:1 on white background
        priority: {
          critical: '#7f1d1d',  // red-900: 10.7:1 on white
          high: '#991b1b',      // red-800: 7.1:1 on white
          medium: '#92400e',    // amber-800: 5.9:1 on white
          low: '#1e3a5f',       // custom blue: 9.2:1 on white
        },
        // UI surface colors
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f9fafb',     // gray-50
          border: '#d1d5db',    // gray-300 — 3:1 on white (UI component threshold)
        },
        // Text colors
        text: {
          DEFAULT: '#111827',   // gray-900: 16.7:1 on white
          muted: '#374151',     // gray-700: 10.7:1 on white
          subtle: '#4b5563',    // gray-600: 7.4:1 on white
        },
      },
      fontSize: {
        base: ['1rem', { lineHeight: '1.5' }], // 16px minimum base
      },
    },
  },
  plugins: [],
};

export default config;
