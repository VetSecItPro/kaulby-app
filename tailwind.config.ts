// A11Y: Tailwind v3+ includes focus-visible utilities by default — FIX-310
// PERF: Consider reducing barrel imports from @/components/ui — FIX-218
import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			'fadeScaleIn': {
  				from: { opacity: '0', transform: 'scale(0.8)' },
  				to: { opacity: '1', transform: 'scale(1)' },
  			},
  			'fadeSlideUp': {
  				from: { opacity: '0', transform: 'translateY(20px)' },
  				to: { opacity: '1', transform: 'translateY(0)' },
  			},
  			'fadeIn': {
  				from: { opacity: '0' },
  				to: { opacity: '1' },
  			},
  			'float': {
  				'0%, 100%': { transform: 'translateY(-4px)' },
  				'50%': { transform: 'translateY(4px)' },
  			},
  			'pingOnce': {
  				'0%': { transform: 'scale(1)', opacity: '0.5' },
  				'100%': { transform: 'scale(1.5)', opacity: '0' },
  			},
  			'bellRing': {
  				'0%, 100%': { transform: 'rotate(0deg)' },
  				'10%, 30%': { transform: 'rotate(-5deg)' },
  				'20%, 40%': { transform: 'rotate(5deg)' },
  				'50%': { transform: 'rotate(0deg)' },
  			},
  			'barPulse': {
  				'0%, 100%': { transform: 'scaleY(0.3)' },
  				'50%': { transform: 'scaleY(1)' },
  			},
  			'connectionDot': {
  				'0%': { transform: 'translateX(0)', opacity: '0' },
  				'50%': { transform: 'translateX(20px)', opacity: '1' },
  				'100%': { transform: 'translateX(40px)', opacity: '0' },
  			},
  			'sparkleFloat': {
  				'0%, 100%': { transform: 'translateY(-10px) scale(0.5)', opacity: '0' },
  				'50%': { transform: 'translateY(-20px) scale(1)', opacity: '1' },
  			},
  			'radarRing': {
  				'0%': { transform: 'scale(1)', opacity: '0.3' },
  				'100%': { transform: 'scale(1.2)', opacity: '0' },
  			},
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  		},
  		zIndex: {
  			'header': '30',
  			'dropdown': '40',
  			'modal': '50',
  			'toast': '100',
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
