/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "hsl(0 0% 3.9%)",
        foreground: "hsl(0 0% 98%)",
        card: "hsl(0 0% 4%)",
        "card-foreground": "hsl(0 0% 98%)",
        primary: "hsl(172 66% 50%)",
        "primary-foreground": "hsl(0 0% 5%)",
        muted: "hsl(0 0% 10%)",
        "muted-foreground": "hsl(0 0% 65%)",
        border: "hsl(0 0% 14%)",
        teal: "hsl(172 66% 50%)",
      },
    },
  },
  plugins: [],
};
