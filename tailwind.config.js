/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
  extend: {
    fontFamily: {
      sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Circular Std', 'sans-serif'],
    },
  },
},

  plugins: [],
};

