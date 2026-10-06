/**
 * @jest-environment jsdom
 */
// Copyright (c) 2026-present Patika. All Rights Reserved.
// See LICENSE for license information.

import {Recording} from './recorder';

import {FakeMediaRecorder, installFakeMedia, micStream, screenStream} from '../tests/fake_media';

describe('Recording', () => {
    beforeEach(installFakeMedia);

    it('records screen + mic as MP4 in one-second chunks and returns the joined video', async () => {
        const screen = screenStream();
        const mic = micStream();
        const recording = new Recording(screen, mic, 0, jest.fn());
        recording.start();

        const rec = FakeMediaRecorder.instances[0];
        expect(rec.timeslice).toBe(1000);
        expect(rec.mimeType).toBe('video/mp4;codecs=avc1,mp4a.40.2');
        expect(rec.stream.getTracks()).toHaveLength(2);

        rec.emit(100);
        rec.emit(50);
        const result = await recording.stop();

        expect(result.blob.size).toBe(150);
        expect(result.mimeType).toBe('video/mp4;codecs=avc1,mp4a.40.2');
        expect(screen.tracks.every((t) => t.stopped)).toBe(true);
        expect(mic.tracks.every((t) => t.stopped)).toBe(true);
    });

    it('auto-stops once the upload size limit is (almost) reached, only once', () => {
        const onAutoStop = jest.fn();
        const recording = new Recording(screenStream(), null, 1000, onAutoStop);
        recording.start();
        const rec = FakeMediaRecorder.instances[0];

        rec.emit(900);
        expect(onAutoStop).not.toHaveBeenCalled();
        rec.emit(60); // 960 >= 95% of 1000
        rec.emit(60);
        expect(onAutoStop).toHaveBeenCalledTimes(1);
        expect(onAutoStop).toHaveBeenCalledWith('size-limit');
    });

    it('stops when the user ends sharing from the browser or OS control', () => {
        const onAutoStop = jest.fn();
        const screen = screenStream();
        new Recording(screen, null, 0, onAutoStop).start();

        screen.tracks[0].end();
        expect(onAutoStop).toHaveBeenCalledWith('sharing-ended');
    });

    it('mutes and unmutes the microphone without stopping the recording', () => {
        const mic = micStream();
        const recording = new Recording(screenStream(), mic, 0, jest.fn());
        recording.start();

        recording.setMicEnabled(false);
        expect(mic.tracks[0].enabled).toBe(false);
        recording.setMicEnabled(true);
        expect(mic.tracks[0].enabled).toBe(true);
        expect(FakeMediaRecorder.instances[0].state).toBe('recording');
    });

    it('cancel discards everything and releases the devices', () => {
        const screen = screenStream();
        const recording = new Recording(screen, null, 0, jest.fn());
        recording.start();
        FakeMediaRecorder.instances[0].emit(500);

        recording.cancel();
        expect(recording.recordedBytes).toBe(500);
        expect(FakeMediaRecorder.instances[0].state).toBe('inactive');
        expect(screen.tracks[0].stopped).toBe(true);
    });
});
