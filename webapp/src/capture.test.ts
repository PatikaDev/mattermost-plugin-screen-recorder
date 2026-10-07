/**
 * @jest-environment jsdom
 */
// Copyright (c) 2026-present Patika. All Rights Reserved.
// See LICENSE for license information.

import {captureBrowserScreen, captureDesktopSource, isDesktopApp, MAX_HEIGHT, MAX_WIDTH} from './capture';

describe('capture constraints', () => {
    const getUserMedia = jest.fn(async () => ({}));
    const getDisplayMedia = jest.fn(async () => ({}));

    beforeEach(() => {
        Object.defineProperty(navigator, 'mediaDevices', {value: {getUserMedia, getDisplayMedia}, configurable: true});
        getUserMedia.mockClear();
        getDisplayMedia.mockClear();
        delete window.desktopAPI;
    });

    it('caps desktop-app capture at 1080p (5K screens break the H.264 encoder)', async () => {
        await captureDesktopSource('screen:3:0');
        expect(getUserMedia).toHaveBeenCalledWith({
            audio: false,
            video: {mandatory: expect.objectContaining({chromeMediaSource: 'desktop', chromeMediaSourceId: 'screen:3:0', maxWidth: MAX_WIDTH, maxHeight: MAX_HEIGHT})},
        });
    });

    it('caps browser capture at 1080p', async () => {
        await captureBrowserScreen();
        expect(getDisplayMedia).toHaveBeenCalledWith(expect.objectContaining({
            video: {width: {max: 1920}, height: {max: 1080}, frameRate: 30},
            audio: false,
        }));
    });

    it('detects the desktop app by its screen-source bridge', () => {
        expect(isDesktopApp()).toBe(false);
        window.desktopAPI = {getDesktopSources: async () => []};
        expect(isDesktopApp()).toBe(true);
    });
});
