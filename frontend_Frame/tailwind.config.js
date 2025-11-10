// tailwind.config.js
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: { extend: {} },
    plugins: [],
    safelist: [
        'opacity-0','opacity-100',
        'translate-x-0','translate-x-full','-translate-x-full',
        'duration-700','ease-in-out',
        'grid','grid-cols-2','grid-rows-2','gap-0',
        'backdrop-blur-sm'
    ],
}
