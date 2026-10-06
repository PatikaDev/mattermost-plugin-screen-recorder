import {defineConfig} from '@playwright/test';

// Chrome records MP4 (the format most users and the desktop app produce);
// Playwright's open-source Chromium has no H.264, so it exercises the WebM fallback.
const mediaFlags = [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--auto-accept-this-tab-capture',
];

export default defineConfig({
    testDir: './tests',
    timeout: 90_000,
    workers: 1,
    retries: 0,
    reporter: [['list']],
    use: {
        baseURL: 'http://localhost:8066',
        viewport: {width: 1400, height: 900},
        permissions: ['microphone'],
        launchOptions: {args: mediaFlags},
    },
    projects: [
        {name: 'chrome-mp4', use: {channel: 'chrome'}},
        {name: 'chromium-webm', use: {channel: 'chromium'}},
    ],
});
