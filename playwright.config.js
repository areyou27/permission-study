// Playwright runs the page in Chromium and WebKit at phone size.
// Setup: npm install, then npx playwright install chromium webkit. Run: npm test.
const { defineConfig, devices } = require('@playwright/test');

const PORT = 4321;

module.exports = defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.js$/,
  timeout: 90000,
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:' + PORT },
  webServer: {
    command: 'node tests/serve.js',
    url: 'http://127.0.0.1:' + PORT + '/index.html',
    env: { PORT: String(PORT) },
    reuseExistingServer: false
  },
  projects: [
    {
      name: 'chromium-phone',
      use: {
        ...devices['Pixel 7'],
        // Chromium's built-in fake camera and microphone, with its prompt auto-accepted.
        launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] }
      }
    },
    { name: 'webkit-phone', use: { ...devices['iPhone 14'] } }
  ]
});
