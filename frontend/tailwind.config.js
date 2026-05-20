/**
 * Tailwind CSS Configuration
 * ==========================
 * 
 * Colors are imported from src/design.js - the single source of truth.
 * Do NOT duplicate color values here.
 */

import { COLORS } from './src/design.js';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        // Enforce 0 border radius everywhere (Swiss Brutalist)
        borderRadius: {
            'none': '0',
            DEFAULT: '0',
            'sm': '0',
            'md': '0',
            'lg': '0',
            'xl': '0',
            '2xl': '0',
            '3xl': '0',
            'full': '0',
        },
        extend: {
            fontFamily: {
                'display': ['"Space Grotesk"', 'system-ui', 'sans-serif'],
                'mono': ['"JetBrains Mono"', 'monospace'],
                'headline': ['"Bebas Neue"', 'Impact', 'sans-serif'],
            },
            colors: {
                // Imported from design.js - single source of truth
                'accent': {
                    DEFAULT: COLORS.accent,
                    'dim': COLORS.accentDim,
                },
                'neutral': COLORS.neutral,
            },
            borderWidth: {
                '1': '1px',
                '2': '2px',
                '3': '3px',
            },
            spacing: {
                '18': '4.5rem',
                '22': '5.5rem',
                '26': '6.5rem',
                '30': '7.5rem',
                '34': '8.5rem',
            },
            animation: {
                'fade-in': 'fadeIn 0.2s ease-out',
                'fade-in-up': 'fadeInUp 0.3s ease-out',
                'slide-in': 'slideIn 0.2s ease-out',
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'count-up': 'countUp 0.3s ease-out',
                'stagger-in': 'fadeInUp 0.3s ease-out forwards',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                fadeInUp: {
                    '0%': { opacity: '0', transform: 'translateY(12px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                slideIn: {
                    '0%': { opacity: '0', transform: 'translateX(-8px)' },
                    '100%': { opacity: '1', transform: 'translateX(0)' },
                },
                countUp: {
                    '0%': { opacity: '0', transform: 'scale(0.96)' },
                    '100%': { opacity: '1', transform: 'scale(1)' },
                }
            },
            transitionDuration: {
                '0': '0ms',
                DEFAULT: '0ms',
            }
        },
    },
    plugins: [],
}
