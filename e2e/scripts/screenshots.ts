// Regenerates the README screenshots in docs/images/ against the local E2E server.
// Usage (server running via scripts/start-server.sh): npx tsx scripts/screenshots.ts
import {chromium, type Page} from '@playwright/test';

import {login, openChannel, startFromAttachMenu} from '../tests/helpers';

const OUT = '../docs/images';

async function shot(page: Page, name: string, clip?: {x: number; y: number; width: number; height: number}) {
    await page.screenshot({path: `${OUT}/${name}.png`, clip});
    console.log(`saved ${name}.png`);
}

async function main() {
    const browser = await chromium.launch({
        channel: 'chrome',
        args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--auto-accept-this-tab-capture'],
    });
    const context = await browser.newContext({baseURL: 'http://localhost:8066', viewport: {width: 1280, height: 800}, deviceScaleFactor: 2, permissions: ['microphone']});
    const page = await context.newPage();
    await login(page, 'admin');
    await openChannel(page, 'town-square');

    if (process.argv.includes('--desktop-only')) {
        await desktopShot(page);
        await browser.close();
        return;
    }

    // 1. The attachment menu entry.
    const attach = page.locator('#post_textbox').
        locator('xpath=ancestor::*[.//button[@aria-label="attachment"]][1]').
        locator('button[aria-label="attachment"]').first();
    await attach.click();
    await page.getByText('Screen recording', {exact: true}).waitFor();
    await shot(page, 'attach-menu', {x: 300, y: 480, width: 980, height: 320});
    await page.keyboard.press('Escape');

    // 2. Browser setup dialog.
    await startFromAttachMenu(page, '#post_textbox');
    await shot(page, 'setup-browser');

    // 3. Recording bar.
    await page.getByRole('button', {name: 'Start recording'}).click();
    await page.getByText('Recording', {exact: true}).waitFor();
    await page.waitForTimeout(3200);
    const bar = await page.locator('.sr-bar').boundingBox();
    await shot(page, 'recording-bar', bar ? {x: bar.x - 24, y: bar.y - 24, width: bar.width + 48, height: bar.height + 48} : undefined);
    await page.getByRole('button', {name: 'Stop', exact: true}).click();
    await page.getByText(/screen-recording-/).first().waitFor({timeout: 20_000});
    await page.locator('#post_textbox').fill('Here is how the new flow works 👇');
    await page.locator('#post_textbox').press('Enter');
    await page.waitForTimeout(4000);

    // 4. The posted video.
    await shot(page, 'posted-video');

    await desktopShot(page);
    await browser.close();
}

// 5. Desktop-app picker: a browser has no desktopAPI, so give the plugin a few fake sources.
async function desktopShot(page: Page) {
    // Sent as a string: tsx would inject helpers into a function that the page doesn't have.
    await page.evaluate(`(() => {
        const thumb = (label, color) => {
            const c = document.createElement('canvas');
            c.width = 320; c.height = 180;
            const g = c.getContext('2d');
            g.fillStyle = color; g.fillRect(0, 0, 320, 180);
            g.fillStyle = '#fff'; g.font = 'bold 22px sans-serif'; g.fillText(label, 20, 96);
            return c.toDataURL();
        };
        window.desktopAPI = {
            getDesktopSources: async () => [
                {id: 'screen:1:0', name: 'Screen 1', thumbnailURL: thumb('Screen 1', '#1e325c')},
                {id: 'screen:2:0', name: 'Screen 2', thumbnailURL: thumb('Screen 2', '#2d5fa8')},
                {id: 'window:3:0', name: 'Design review — Figma', thumbnailURL: thumb('Figma', '#7a3fd1')},
                {id: 'window:4:0', name: 'Terminal', thumbnailURL: thumb('Terminal', '#2b2b2b')},
            ],
        };
    })()`);
    await startFromAttachMenu(page, '#post_textbox');
    await page.locator('.sr-source').first().waitFor();
    await page.waitForTimeout(800); // let the dialog's fade-in finish
    await shot(page, 'setup-desktop');
    await page.getByRole('button', {name: 'Cancel'}).click();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
