import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', outputDir: './node_modules/.cache/binding-ui-results', reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5178', channel: 'msedge', headless: true },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5178 --strictPort', url: 'http://127.0.0.1:5178', reuseExistingServer: false }
});
