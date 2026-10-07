// Copyright (c) 2026-present Patika. All Rights Reserved.
// See LICENSE for license information.

// Two ways to get the screen:
// - Browsers: navigator.mediaDevices.getDisplayMedia(), with the browser's own picker.
// - Mattermost desktop app: it does not handle getDisplayMedia(). It exposes
//   window.desktopAPI.getDesktopSources() instead (the bridge the Calls plugin uses,
//   which the desktop app explicitly allows other plugins to call). It runs the
//   permission prompts; we show our own picker and capture the chosen source with
//   getUserMedia({chromeMediaSource: 'desktop'}).

export type DesktopSource = {
    id: string;
    name: string;
    thumbnailURL: string;
};

type DesktopAPI = {
    getDesktopSources?: (opts: {types: string[]; thumbnailSize: {width: number; height: number}}) => Promise<DesktopSource[]>;
};

declare global {
    interface Window {
        desktopAPI?: DesktopAPI;

        // Set by the end-to-end tests so headless Chromium can capture its own tab.
        screenRecorderTestMode?: boolean;
    }
}

export function isDesktopApp(): boolean {
    return typeof window.desktopAPI?.getDesktopSources === 'function';
}

export function canRecord(): boolean {
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices) {
        return false;
    }
    return isDesktopApp() || typeof navigator.mediaDevices.getDisplayMedia === 'function';
}

export async function listDesktopSources(): Promise<DesktopSource[]> {
    const sources = await window.desktopAPI!.getDesktopSources!({
        types: ['screen', 'window'],
        thumbnailSize: {width: 320, height: 180},
    });
    return sources || [];
}

// High-DPI and 4K/5K screens capture at their backing size (a 5K monitor gives
// 6400x3600), which is beyond what the H.264 (MP4) encoder accepts and wastes CPU
// and upload size. 1080p keeps screen text readable and files small.
export const MAX_WIDTH = 1920;
export const MAX_HEIGHT = 1080;

export function captureDesktopSource(sourceId: string): Promise<MediaStream> {
    // Chromium's legacy constraint syntax is the only way to capture a desktop source.
    const video = {
        mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId,
            maxWidth: MAX_WIDTH,
            maxHeight: MAX_HEIGHT,
            maxFrameRate: 30,
        },
    } as unknown as MediaTrackConstraints;
    return navigator.mediaDevices.getUserMedia({audio: false, video});
}

export function captureBrowserScreen(): Promise<MediaStream> {
    const options: DisplayMediaStreamOptions & Record<string, unknown> = {
        video: {width: {max: MAX_WIDTH}, height: {max: MAX_HEIGHT}, frameRate: 30},
        audio: false,
    };
    if (window.screenRecorderTestMode) {
        options.preferCurrentTab = true;
    }
    return navigator.mediaDevices.getDisplayMedia(options);
}

export function captureMicrophone(): Promise<MediaStream> {
    return navigator.mediaDevices.getUserMedia({
        audio: {echoCancellation: true, noiseSuppression: true},
        video: false,
    });
}

export function stopStream(stream: MediaStream | null | undefined) {
    stream?.getTracks().forEach((track) => track.stop());
}
