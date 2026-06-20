import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',

    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/**/*.js'
      ],
      exclude: [
        'node_modules/',
        'dist/',
        'src/shared/*.js',
        'src/ui/*.js',
        'src/cliente/sidebar.js',
        'src/psicologo/sidebar.js',
        'src/services/*.js',
        'src/cliente/guardarEnSupabase.js',
        'src/cliente/registrarEnCalendario.js'




      ]
    }
  }
});