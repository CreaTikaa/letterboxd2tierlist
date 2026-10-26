import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths so the build works both locally and under /letterboxd2tierlist/ on GitHub Pages.
  base: './',
  plugins: [react(), tailwindcss()],
})
