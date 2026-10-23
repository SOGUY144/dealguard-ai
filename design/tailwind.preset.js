// DealGuard AI — Tailwind preset
// ใช้ใน tailwind.config.js:  presets: [require('./tailwind.preset.js')]
// คลาสกระจก (.glass, .btn-primary ฯลฯ) อยู่ใน tokens.css

module.exports = {
  theme: {
    extend: {
      colors: {
        bg: '#F6F3FB',
        ink: { DEFAULT: '#2B2D3E', 2: '#34364C' },
        muted: '#5F6178',
        accent: {
          DEFAULT: '#7A5AE0',
          hover: '#6646CF',
          ink: '#5B3FC4',
          strong: '#4B2FB0',
          tint: '#EFE9FD',
          tint2: '#F4EFFE',
          surface: '#FAF8FE',
          border: '#D9CCF9',
        },
        line: { DEFAULT: '#E6DEF5', soft: '#F1ECFA' },
        warn: { DEFAULT: '#C2570C', ink: '#8A3C0B', bg: '#FDF0E6' },
        ok: { ink: '#1D6B4A', bg: '#E3F4EB' },
        voice: '#2B2D3E',
        chart: { base: '#3E9BD6', ai: '#7A5AE0' },
        tile: { lavender: '#EFE9FD', blue: '#DDEBFB', mint: '#DAF2E6' },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans Thai"', '"Leelawadee UI"', 'Tahoma', 'sans-serif'],
      },
      borderRadius: {
        card: '26px',
        'card-sm': '18px',
        input: '14px',
      },
      boxShadow: {
        card: '0 16px 40px rgba(110, 90, 170, 0.10)',
        soft: '0 8px 22px rgba(110, 90, 170, 0.10)',
      },
      minHeight: { touch: '44px' },
      minWidth: { touch: '44px' },
    },
  },
};
