// Copyright (c) 2026-present Patika. All Rights Reserved.
// See LICENSE for license information.

import {extensionFor, formatDuration, pickMimeType, recordingFileName} from './media_format';

describe('pickMimeType', () => {
    it('prefers MP4 with AAC when audio is recorded and supported', () => {
        expect(pickMimeType(true, () => true)).toBe('video/mp4;codecs=avc1,mp4a.40.2');
    });

    it('prefers video-only MP4 when there is no audio', () => {
        expect(pickMimeType(false, () => true)).toBe('video/mp4;codecs=avc1');
    });

    it('falls back to WebM where MP4 is not supported (Firefox)', () => {
        const firefox = (type: string) => type.startsWith('video/webm');
        expect(pickMimeType(true, firefox)).toBe('video/webm;codecs=vp9,opus');
        expect(pickMimeType(false, firefox)).toBe('video/webm;codecs=vp9');
    });

    it('returns null when nothing is supported', () => {
        expect(pickMimeType(true, () => false)).toBeNull();
    });
});

describe('file naming', () => {
    it('maps the container to an extension', () => {
        expect(extensionFor('video/mp4;codecs=avc1')).toBe('mp4');
        expect(extensionFor('video/webm;codecs=vp9')).toBe('webm');
    });

    it('names recordings with the local date and time', () => {
        const date = new Date(2026, 9, 6, 9, 5);
        expect(recordingFileName(date, 'video/mp4')).toBe('screen-recording-2026-10-06-0905.mp4');
    });
});

describe('formatDuration', () => {
    it('formats minutes and zero-padded seconds', () => {
        expect(formatDuration(0)).toBe('0:00');
        expect(formatDuration(65_400)).toBe('1:05');
        expect(formatDuration(-5)).toBe('0:00');
    });
});
