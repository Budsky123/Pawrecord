/** @type {import('tailwindcss').Config} */
export default {
  content: ['./Frontend/index.html', './Frontend/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-page': '#FFE4E1',
        'bg-sidebar': '#FFE9E6',
        surface: '#F8D3D6',
        'surface-inner': '#FFF1EF',
        primary: '#C8627A',
        'primary-hover': '#B5546B',
        'text-primary': '#4A2C32',
        'text-muted': '#9A6F76',
        border: '#F0BFC4',
        status: { neutral: '#F5E9E6', rose: '#F8C4CE', scheduled: '#95A49E', medication: '#67565C' },
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        heading: ['Manrope', 'sans-serif'],
      },
      borderRadius: { xl: '0.75rem', '2xl': '1rem' },
      boxShadow: { primary: '0 4px 10px rgb(153 65 89 / 16%)' },
    },
  },
  plugins: [],
};
