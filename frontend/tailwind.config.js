/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          500: '#5b7cfa',
          600: '#4b6cf0'
        }
      }
    }
  },
  plugins: [],
}


