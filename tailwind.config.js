import { fontFamily } from 'tailwindcss/defaultTheme';

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        felt: {
          DEFAULT: '#1a3a2a',
          dark: '#112518',
          light: '#2a5040',
        },
        parchment: '#f5e6c8',
        gold: {
          DEFAULT: '#c9a84c',
          light: '#e8c96a',
          dark: '#8a6a1a',
        },
        mtg: {
          grave: '#1a1208',
          exile: '#1a0f2a',
          hand: '#0f1a2a',
        },
      },
      fontFamily: {
        display: ['"Cinzel"', ...fontFamily.serif],
        body: ['"Crimson Text"', ...fontFamily.serif],
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
        'card-glow': '0 0 12px rgba(201,168,76,0.4), 0 2px 8px rgba(0,0,0,0.6)',
        'zone': 'inset 0 2px 12px rgba(0,0,0,0.4)',
      },
      backgroundImage: {
        'felt-pattern': "radial-gradient(ellipse at 50% 0%, #2a5040 0%, #112518 60%)",
        'grave-pattern': "radial-gradient(ellipse at 50% 50%, #2a1a08 0%, #0f0a04 100%)",
        'exile-pattern': "radial-gradient(ellipse at 50% 50%, #2a1040 0%, #0f0820 100%)",
        'hand-pattern': "linear-gradient(180deg, #0f1520 0%, #0a0f18 100%)",
      },
    },
  },
  plugins: [],
};
