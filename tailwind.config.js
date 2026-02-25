/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            animation: {
                'glow-warning': 'glow-warning 2s ease-in-out infinite',
                'glow-critical': 'glow-critical 0.8s ease-in-out infinite',
                'blink': 'clock-blink 1s step-end infinite',
                'beat': 'count-beat 1s ease-out',
                'fade-out': 'fade-out 2s ease-out forwards',
            },
            keyframes: {
                'glow-warning': {
                    '0%, 100%': { textShadow: '0 0 0px rgba(251, 191, 36, 0)' },
                    '50%': { textShadow: '0 0 40px rgba(251, 191, 36, 0.8)' },
                },
                'glow-critical': {
                    '0%, 100%': { textShadow: '0 0 0px rgba(248, 113, 113, 0)' },
                    '50%': { textShadow: '0 0 60px rgba(248, 113, 113, 1)' },
                },
                'clock-blink': {
                    '0%, 49%': { opacity: '1' },
                    '50%, 100%': { opacity: '0' },
                },
                'count-beat': {
                    '0%': { transform: 'scale(1.00)' },
                    '20%': { transform: 'scale(1.07)' },
                    '100%': { transform: 'scale(1.00)' },
                },
                'fade-out': {
                    '0%': { opacity: '1' },
                    '70%': { opacity: '1' },
                    '100%': { opacity: '0' },
                },
            },
        },
    },
    plugins: [],
}
