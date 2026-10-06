import {expect, type Page} from '@playwright/test';

export const PASSWORD = 'Test-Passw0rd!';
export const TEAM = 'e2e';

// Mattermost only accepts session cookies on API calls that identify as its web app.
export function api<T = any>(page: Page, method: string, path: string, body?: unknown): Promise<T> {
    return page.evaluate(async ([m, p, b]) => {
        const csrf = document.cookie.split('; ').find((c) => c.startsWith('MMCSRF='))?.split('=')[1] || '';
        const res = await fetch(`/api/v4${p}`, {
            method: m as string,
            headers: {'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/json', 'X-CSRF-Token': csrf},
            body: b === undefined ? undefined : JSON.stringify(b),
        });
        return res.json();
    }, [method, path, body] as const);
}

// Log in through the real form (API logins don't set the browser session cookies),
// then switch off the first-run onboarding overlay, which would swallow clicks.
export async function login(page: Page, username: string) {
    await page.addInitScript(() => {
        window.screenRecorderTestMode = true;
    });
    await page.goto('/login');

    // A fresh browser first gets "Where would you like to view this?" (rendered client-side).
    const loginField = page.locator('#input_loginId');
    const viewInBrowser = page.getByText('View in Browser');
    await expect(loginField.or(viewInBrowser)).toBeVisible();
    if (await viewInBrowser.isVisible()) {
        await viewInBrowser.click();
    }
    await loginField.fill(username);
    await page.locator('input[type=password]').fill(PASSWORD);
    await page.getByRole('button', {name: 'Log in'}).click();
    await page.waitForURL((url) => !url.toString().includes('/login'));

    const me = await api(page, 'GET', '/users/me');
    const pref = (category: string, name: string, value: string) => ({user_id: me.id, category, name, value});
    await api(page, 'PUT', '/users/me/preferences', [
        pref('onboarding_task_list', 'onboarding_task_list_show', 'false'),
        pref('onboarding_task_list', 'onboarding_task_list_open', 'false'),
        pref('recommended_next_steps', 'hide', 'true'),
        pref('tutorial_step', me.id, '999'),
        pref('crt_thread_pane_step', me.id, '999'),
    ]);
    return me;
}

export async function openChannel(page: Page, channel: string) {
    await page.goto(`/${TEAM}/channels/${channel}`);
    for (let i = 0; i < 3; i++) {
        await page.keyboard.press('Escape');
    }
    await expect(page.locator('#post_textbox')).toBeVisible();
}

// Opens the 📎 menu of the given message box and picks "Screen recording".
export async function startFromAttachMenu(page: Page, textboxSelector: string) {
    const attach = page.locator(textboxSelector).
        locator('xpath=ancestor::*[.//button[@aria-label="attachment"]][1]').
        locator('button[aria-label="attachment"]').first();
    await attach.click();
    await page.getByText('Screen recording', {exact: true}).click();
    await expect(page.getByRole('dialog', {name: 'Screen recording'})).toBeVisible();
}

// Loads a posted video in the page and reports whether it really plays.
export function probeVideo(page: Page, fileId: string) {
    return page.evaluate(async (id) => {
        const video = document.createElement('video');
        video.muted = true;
        video.src = `/api/v4/files/${id}`;
        document.body.appendChild(video);
        await new Promise((resolve, reject) => {
            video.onloadedmetadata = resolve;
            video.onerror = () => reject(new Error(`video failed to load: ${video.error?.code}`));
        });
        const width = video.videoWidth;
        const reportedDuration = video.duration;
        await video.play();
        await new Promise((r) => setTimeout(r, 1500));
        const result = {
            width,
            reportedDuration,
            played: video.currentTime > 0.5,
            audioBytes: (video as any).webkitAudioDecodedByteCount as number,
        };
        video.pause();
        video.remove();
        return result;
    }, fileId);
}
