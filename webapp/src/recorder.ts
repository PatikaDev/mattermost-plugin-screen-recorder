// Copyright (c) 2026-present Patika. All Rights Reserved.
// See LICENSE for license information.

import fixWebmDuration from 'fix-webm-duration';

import {stopStream} from './capture';
import {pickMimeType} from './media_format';

export type AutoStopReason = 'size-limit' | 'sharing-ended' | 'encoder-error';

export type FinishedRecording = {
    blob: Blob;
    mimeType: string;
};

// Leave headroom under the server's upload limit: the container adds a little
// after the last chunk, and an upload that is even one byte over is rejected.
const SIZE_LIMIT_HEADROOM = 0.95;

// ~2.5 Mbit/s keeps text on a 1080p screen readable; 500 MB is then ~25 minutes.
const VIDEO_BITS_PER_SECOND = 2_500_000;

export class Recording {
    private recorder: MediaRecorder;
    private mimeType = 'video/webm';
    private readonly combined: MediaStream;
    private readonly hasAudio: boolean;
    private readonly chunks: Blob[] = [];
    private readonly stopped: Promise<void>;
    private resolveStopped: () => void = () => undefined;
    private bytes = 0;
    private startedAt = 0;
    private autoStopped = false;
    private discarded = false;

    constructor(
        private readonly screen: MediaStream,
        private readonly mic: MediaStream | null,
        private readonly maxBytes: number,
        private readonly onAutoStop: (reason: AutoStopReason) => void,
    ) {
        const audioTracks = mic ? mic.getAudioTracks() : [];
        this.hasAudio = audioTracks.length > 0;
        this.combined = new MediaStream([...screen.getVideoTracks(), ...audioTracks]);
        this.stopped = new Promise((resolve) => {
            this.resolveStopped = resolve;
        });
        this.recorder = this.createRecorder(pickMimeType(this.hasAudio));

        // The user can end the capture from the browser's or OS's own "Stop sharing" control.
        screen.getVideoTracks().forEach((track) => {
            track.addEventListener('ended', () => this.triggerAutoStop('sharing-ended'));
        });
    }

    start() {
        // Emit a chunk every second so the size limit is enforced while recording.
        this.startedAt = Date.now();
        this.recorder.start(1000);
    }

    get recordedBytes(): number {
        return this.bytes;
    }

    get format(): string {
        return this.mimeType;
    }

    setMicEnabled(enabled: boolean) {
        this.mic?.getAudioTracks().forEach((track) => {
            track.enabled = enabled;
        });
    }

    async stop(): Promise<FinishedRecording> {
        if (this.recorder.state !== 'inactive') {
            this.recorder.stop();
        }
        await this.stopped;
        this.releaseDevices();
        const durationMs = Date.now() - this.startedAt;
        let blob = new Blob(this.chunks, {type: this.mimeType});

        // MediaRecorder writes WebM without a duration, so players show no length and
        // seeking misbehaves. MP4 carries it already. Patch it in, or keep the original.
        if (this.mimeType.startsWith('video/webm')) {
            try {
                blob = await fixWebmDuration(blob, durationMs, {logger: false});
            } catch {
                // An unpatched video still plays; only the length display is missing.
            }
        }
        return {blob, mimeType: this.mimeType};
    }

    cancel() {
        this.discarded = true;
        if (this.recorder.state !== 'inactive') {
            this.recorder.stop();
        }
        this.chunks.length = 0;
        this.releaseDevices();
    }

    private createRecorder(mimeType: string | null): MediaRecorder {
        const recorder = new MediaRecorder(this.combined, {
            ...(mimeType ? {mimeType} : {}),
            videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
        });
        this.mimeType = recorder.mimeType || mimeType || 'video/webm';

        recorder.ondataavailable = (event: BlobEvent) => {
            if (recorder !== this.recorder || !event.data || event.data.size === 0 || this.discarded) {
                return;
            }
            this.chunks.push(event.data);
            this.bytes += event.data.size;
            if (this.maxBytes > 0 && this.bytes >= this.maxBytes * SIZE_LIMIT_HEADROOM) {
                this.triggerAutoStop('size-limit');
            }
        };
        recorder.onerror = () => this.handleRecorderError(recorder);
        recorder.onstop = () => {
            if (recorder === this.recorder) {
                this.resolveStopped();
            }
        };
        return recorder;
    }

    // An encoder can accept a format in isTypeSupported() and still reject the actual
    // stream — H.264 refuses frames above its maximum size. If that happens before any
    // data was written, switch to WebM transparently; otherwise keep what we have.
    private handleRecorderError(failed: MediaRecorder) {
        if (failed !== this.recorder || this.discarded) {
            return;
        }
        if (this.bytes === 0 && this.mimeType.startsWith('video/mp4')) {
            const webm = pickMimeType(this.hasAudio, (type) => type.startsWith('video/webm') && MediaRecorder.isTypeSupported(type));
            if (webm) {
                this.recorder = this.createRecorder(webm);
                this.recorder.start(1000);
                return;
            }
        }
        this.triggerAutoStop('encoder-error');
    }

    private triggerAutoStop(reason: AutoStopReason) {
        if (this.autoStopped || this.discarded) {
            return;
        }
        this.autoStopped = true;
        this.onAutoStop(reason);
    }

    private releaseDevices() {
        stopStream(this.screen);
        stopStream(this.mic);
    }
}
