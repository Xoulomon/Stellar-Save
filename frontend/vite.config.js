import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// https://vite.dev/config/
export default defineConfig({
<<<<<<< HEAD
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'src/**/*.example.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/test/**',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/**/*.example.tsx',
        'src/main.tsx',
        'src/index.css',
        'src/assets/**',
        'src/img/**',
        'src/svg/**',
        'src/components/ContributionStatusDemo.tsx',
        'src/components/SpinnerDemo.tsx',
        'src/components/GroupTimeline.example.tsx',
        'src/components/GroupList.example.tsx',
        'src/components/Toast/ToastDemo.tsx',
      ],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 95,
        statements: 95,
      },
      all: true,
    },
  },
=======
    plugins: [react()],
>>>>>>> 0b228e5fd2b3d16ad81a5c4e0abc701ac9274bf2
});
