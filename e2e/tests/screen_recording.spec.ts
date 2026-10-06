import {expect, test} from '@playwright/test';

import {api, login, openChannel, probeVideo, startFromAttachMenu, TEAM} from './helpers';

const RECORD_MS = 4000;

async function recordAndStop(page: import('@playwright/test').Page, includeMic: boolean) {
    const mic = page.getByLabel('Include microphone narration');
    if ((await mic.isChecked()) !== includeMic) {
        await mic.click();
    }
    await page.getByRole('button', {name: 'Start recording'}).click();
    await expect(page.getByText('Recording', {exact: true})).toBeVisible();
    await page.waitForTimeout(RECORD_MS);
    await page.getByRole('button', {name: 'Stop', exact: true}).click();
}

async function latestPost(page: import('@playwright/test').Page, channelId: string) {
    const posts = await api(page, 'GET', `/channels/${channelId}/posts?per_page=5`);
    return posts.posts[posts.order[0]];
}

test.describe('Screen recording', () => {
    let channelId = '';

    test.beforeEach(async ({page}, info) => {
        if (info.project.name.includes('webm')) {
            // Hide MP4 support so the WebM fallback (what Firefox records) is tested end to end.
            await page.addInitScript(() => {
                const original = MediaRecorder.isTypeSupported.bind(MediaRecorder);
                MediaRecorder.isTypeSupported = (type: string) => !type.startsWith('video/mp4') && original(type);
            });
        }
        await login(page, 'admin');
        channelId = (await api(page, 'GET', `/teams/name/${TEAM}/channels/name/town-square`)).id;
        await openChannel(page, 'town-square');
    });

    test('records the screen with narration and posts a playable video', async ({page}, info) => {
        await startFromAttachMenu(page, '#post_textbox');
        await recordAndStop(page, true);

        // The video lands in the message box like any other attachment
        // (the preview truncates long names, so match the prefix only).
        await expect(page.locator('#post_textbox').
            locator('xpath=ancestor::*[contains(@class,"post-create") or contains(@class,"AdvancedTextEditor")][1]').
            getByText(/screen-recording-/)).toBeVisible({timeout: 20_000});
        await page.locator('#post_textbox').press('Enter');

        await expect.poll(async () => (await latestPost(page, channelId)).file_ids?.length || 0, {timeout: 20_000}).toBe(1);
        const post = await latestPost(page, channelId);
        const file = await api(page, 'GET', `/files/${post.file_ids[0]}/info`);
        const expectedExt = info.project.name === 'chrome-mp4' ? 'mp4' : 'webm';
        expect(file.name).toMatch(new RegExp(`^screen-recording-\\d{4}-\\d{2}-\\d{2}-\\d{4}\\.${expectedExt}$`));
        expect(file.mime_type).toMatch(/^video\//);
        expect(file.size).toBeGreaterThan(10_000);

        const probe = await probeVideo(page, file.id);
        info.annotations.push({type: 'probe', description: JSON.stringify(probe)});
        expect(probe.width).toBeGreaterThan(0);

        // A player must know the length (WebM straight from MediaRecorder reports none).
        expect(probe.reportedDuration).not.toBeNull();
        expect(Math.abs(probe.reportedDuration - (RECORD_MS / 1000))).toBeLessThan(1.5);
        expect(probe.played).toBe(true);
        expect(probe.audioBytes).toBeGreaterThan(0);
    });

    test('a recording started from a thread reply goes into that thread', async ({page}) => {
        const root = await api(page, 'POST', '/posts', {channel_id: channelId, message: `thread ${Date.now()}`});
        await page.reload();
        const rootEl = page.locator(`#post_${root.id}`);
        await rootEl.hover();
        await rootEl.locator('button[aria-label*="reply" i]').first().click();
        await expect(page.locator('#reply_textbox')).toBeVisible();

        await startFromAttachMenu(page, '#reply_textbox');
        await recordAndStop(page, false);
        await expect(page.locator('#reply_textbox').
            locator('xpath=ancestor::*[contains(@class,"post-create") or contains(@class,"AdvancedTextEditor")][1]').
            getByText(/screen-recording-/)).toBeVisible({timeout: 20_000});
        await page.locator('#reply_textbox').press('Enter');

        await expect.poll(async () => {
            const thread = await api(page, 'GET', `/posts/${root.id}/thread`);
            return Object.values<any>(thread.posts).filter((p) => p.root_id === root.id && p.file_ids?.length).length;
        }, {timeout: 20_000}).toBe(1);
    });

    test('cancel discards the recording and leaves the message box empty', async ({page}) => {
        await startFromAttachMenu(page, '#post_textbox');
        await page.getByRole('button', {name: 'Start recording'}).click();
        await expect(page.getByText('Recording', {exact: true})).toBeVisible();
        await page.waitForTimeout(1500);
        await page.getByRole('button', {name: 'Cancel'}).click();

        await expect(page.getByText('Recording', {exact: true})).toBeHidden();
        await page.waitForTimeout(1500);
        const composer = page.locator('#post_textbox').
            locator('xpath=ancestor::*[contains(@class,"post-create") or contains(@class,"AdvancedTextEditor")][1]');
        await expect(composer.getByText(/screen-recording-/)).toHaveCount(0);
    });
});
