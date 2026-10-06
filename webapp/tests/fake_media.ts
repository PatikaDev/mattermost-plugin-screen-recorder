// Copyright (c) 2026-present Patika. All Rights Reserved.
// See LICENSE for license information.

// Minimal stand-ins for the browser media APIs that jsdom does not implement.

export class FakeTrack extends EventTarget {
    enabled = true;
    stopped = false;

    constructor(public readonly kind: 'audio' | 'video') {
        super();
    }

    stop() {
        this.stopped = true;
    }

    // Simulates the browser's / OS's own "Stop sharing" control.
    end() {
        this.dispatchEvent(new Event('ended'));
    }
}

export class FakeStream {
    readonly tracks: FakeTrack[];

    constructor(tracks: FakeTrack[]) {
        this.tracks = tracks;
    }

    getTracks() {
        return this.tracks;
    }

    getVideoTracks() {
        return this.tracks.filter((t) => t.kind === 'video');
    }

    getAudioTracks() {
        return this.tracks.filter((t) => t.kind === 'audio');
    }
}

export class FakeMediaRecorder {
    static instances: FakeMediaRecorder[] = [];
    static supported = (type: string) => type.startsWith('video/mp4');
    static isTypeSupported(type: string) {
        return FakeMediaRecorder.supported(type);
    }

    state: 'inactive' | 'recording' = 'inactive';
    mimeType: string;
    timeslice = 0;
    ondataavailable: ((e: {data: Blob}) => void) | null = null;
    onstop: (() => void) | null = null;

    constructor(public readonly stream: FakeStream, options: {mimeType?: string} = {}) {
        this.mimeType = options.mimeType || '';
        FakeMediaRecorder.instances.push(this);
    }

    start(timeslice: number) {
        this.timeslice = timeslice;
        this.state = 'recording';
    }

    stop() {
        this.state = 'inactive';
        this.onstop?.();
    }

    emit(bytes: number) {
        this.ondataavailable?.({data: new Blob([new Uint8Array(bytes)])});
    }
}

export function installFakeMedia() {
    FakeMediaRecorder.instances = [];
    FakeMediaRecorder.supported = (type: string) => type.startsWith('video/mp4');
    (global as any).MediaRecorder = FakeMediaRecorder;
    (global as any).MediaStream = FakeStream;
}

export const screenStream = () => new FakeStream([new FakeTrack('video')]) as unknown as MediaStream & FakeStream;
export const micStream = () => new FakeStream([new FakeTrack('audio')]) as unknown as MediaStream & FakeStream;
