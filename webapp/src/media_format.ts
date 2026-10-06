// Copyright (c) 2026-present Patika. All Rights Reserved.
// See LICENSE for license information.

// Recording formats, best first. MP4 plays everywhere, including the iOS app;
// Chromium (and so the Mattermost desktop app) can record it. Firefox can only
// record WebM, which the iOS app cannot play.
const WITH_AUDIO = [
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4;codecs=avc1,opus',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
];

const VIDEO_ONLY = [
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
];

export function pickMimeType(
    hasAudio: boolean,
    isSupported: (type: string) => boolean = (type) => MediaRecorder.isTypeSupported(type),
): string | null {
    const candidates = hasAudio ? WITH_AUDIO : VIDEO_ONLY;
    return candidates.find((type) => isSupported(type)) ?? null;
}

export function extensionFor(mimeType: string): 'mp4' | 'webm' {
    return mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
}

function pad(n: number): string {
    return String(n).padStart(2, '0');
}

// screen-recording-2026-10-06-1415.mp4, in the user's local time.
export function recordingFileName(date: Date, mimeType: string): string {
    const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
    return `screen-recording-${stamp}.${extensionFor(mimeType)}`;
}

export function formatDuration(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(total / 60)}:${pad(total % 60)}`;
}
