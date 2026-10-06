/**
 * @jest-environment jsdom
 */
// Copyright (c) 2026-present Patika. All Rights Reserved.
// See LICENSE for license information.

import * as capture from './capture';
import {controller} from './controller';

import {FakeMediaRecorder, installFakeMedia, micStream, screenStream} from '../tests/fake_media';

jest.mock('./capture', () => ({
    canRecord: jest.fn(),
    isDesktopApp: jest.fn(),
    listDesktopSources: jest.fn(),
    captureBrowserScreen: jest.fn(),
    captureDesktopSource: jest.fn(),
    captureMicrophone: jest.fn(),
    stopStream: (s: MediaStream | null) => s?.getTracks().forEach((t) => t.stop()),
}));

const mocked = capture as jest.Mocked<typeof capture>;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const MB = 1024 * 1024;

function domError(name: string) {
    const err = new Error(name);
    err.name = name;
    return err;
}

beforeEach(() => {
    installFakeMedia();
    controller.cancel();
    controller.dismissNotice();
    controller.configure({getMaxBytes: () => 500 * MB});
    window.localStorage.clear();
    mocked.canRecord.mockReturnValue(true);
    mocked.isDesktopApp.mockReturnValue(false);
    mocked.captureBrowserScreen.mockImplementation(async () => screenStream());
    mocked.captureDesktopSource.mockImplementation(async () => screenStream());
    mocked.captureMicrophone.mockImplementation(async () => micStream());
});

describe('browser', () => {
    it('records and hands the video to the composer that opened it', async () => {
        const upload = jest.fn();
        controller.open(upload);
        expect(controller.getState()).toMatchObject({phase: 'setup', isDesktop: false, includeMic: true});

        await controller.start();
        expect(controller.getState()).toMatchObject({phase: 'recording', hasMic: true});
        FakeMediaRecorder.instances[0].emit(2048);

        await controller.stop();
        expect(upload).toHaveBeenCalledTimes(1);
        const [file] = upload.mock.calls[0][0] as File[];
        expect(file.name).toMatch(/^screen-recording-\d{4}-\d{2}-\d{2}-\d{4}\.mp4$/);
        expect(file.type).toBe('video/mp4;codecs=avc1,mp4a.40.2');
        expect(file.size).toBe(2048);
        expect(controller.getState().phase).toBe('idle');
    });

    it('returns to idle quietly when the user closes the browser picker', async () => {
        mocked.captureBrowserScreen.mockRejectedValueOnce(domError('NotAllowedError'));
        controller.open(jest.fn());
        await controller.start();
        expect(controller.getState()).toMatchObject({phase: 'idle', error: ''});
    });

    it('records without sound when the microphone is unavailable', async () => {
        mocked.captureMicrophone.mockRejectedValueOnce(domError('NotAllowedError'));
        controller.open(jest.fn());
        await controller.start();
        expect(controller.getState()).toMatchObject({phase: 'recording', hasMic: false});
        expect(controller.getState().notice).toMatch(/Microphone unavailable/);
    });

    it('skips the microphone when the user unticks it, and remembers that', async () => {
        controller.open(jest.fn());
        controller.setIncludeMic(false);
        await controller.start();
        expect(mocked.captureMicrophone).not.toHaveBeenCalled();
        controller.cancel();

        controller.open(jest.fn());
        expect(controller.getState().includeMic).toBe(false);
    });

    it('explains when the browser cannot record at all', () => {
        mocked.canRecord.mockReturnValue(false);
        controller.open(jest.fn());
        expect(controller.getState().error).toMatch(/cannot record the screen/);
    });
});

describe('desktop app', () => {
    beforeEach(() => mocked.isDesktopApp.mockReturnValue(true));

    it('lists sources, preselects a screen, and records the chosen one', async () => {
        mocked.listDesktopSources.mockResolvedValue([
            {id: 'window:1:0', name: 'Notes', thumbnailURL: 'data:,'},
            {id: 'screen:0:0', name: 'Entire screen', thumbnailURL: 'data:,'},
        ]);
        controller.open(jest.fn());
        await flush();
        expect(controller.getState()).toMatchObject({isDesktop: true, selectedSourceId: 'screen:0:0'});

        controller.selectSource('window:1:0');
        await controller.start();
        expect(mocked.captureDesktopSource).toHaveBeenCalledWith('window:1:0');
        expect(controller.getState().phase).toBe('recording');
    });

    it('shows the permission problem instead of failing silently', async () => {
        mocked.listDesktopSources.mockRejectedValue(new Error('permissions denied'));
        controller.open(jest.fn());
        await flush();
        expect(controller.getState().phase).toBe('setup');
        expect(controller.getState().error).toMatch(/not allowed|denied/i);
    });
});

describe('limits and cancel', () => {
    it('stops at the server upload limit, still posts what was recorded, and says why', async () => {
        controller.configure({getMaxBytes: () => Number(MB)});
        const upload = jest.fn();
        controller.open(upload);
        await controller.start();

        FakeMediaRecorder.instances[0].emit(MB);
        await flush();

        expect(upload).toHaveBeenCalledTimes(1);
        expect(controller.getState()).toMatchObject({phase: 'idle'});
        expect(controller.getState().notice).toMatch(/1 MB upload limit/);
    });

    it('cancel posts nothing', async () => {
        const upload = jest.fn();
        controller.open(upload);
        await controller.start();
        FakeMediaRecorder.instances[0].emit(4096);

        controller.cancel();
        expect(upload).not.toHaveBeenCalled();
        expect(controller.getState().phase).toBe('idle');
    });

    it('ignores a second attachment-menu click while busy', async () => {
        const first = jest.fn();
        controller.open(first);
        await controller.start();
        controller.open(jest.fn());
        expect(controller.getState().phase).toBe('recording');

        FakeMediaRecorder.instances[0].emit(10);
        await controller.stop();
        expect(first).toHaveBeenCalledTimes(1);
    });
});
