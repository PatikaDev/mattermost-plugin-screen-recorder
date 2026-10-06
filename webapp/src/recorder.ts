// Copyright (c) 2026-present Patika. All Rights Reserved.
// See LICENSE for license information.

import fixWebmDuration from 'fix-webm-duration';

import {stopStream} from './capture';
import {pickMimeType} from './media_format';

export type AutoStopReason = 'size-limit' | 'sharing-ended';

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
    private readonly recorder: MediaRecorder;
    private readonly chunks: Blob[] = [];
    private readonly mimeType: string;
    private readonly stopped: Promise<void>;
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
        const tracks = [...screen.getVideoTracks(), ...(mic ? mic.getAudioTracks() : [])];
        const combined = new MediaStream(tracks);
        const mimeType = pickMimeType(Boolean(mic && mic.getAudioTracks().length));
        this.recorder = new MediaRecorder(combined, {
            ...(mimeType ? {mimeType} : {}),
            videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
        });
        this.mimeType = this.recorder.mimeType || mimeType || 'video/webm';

        this.stopped = new Promise((resolve) => {
            this.recorder.onstop = () => resolve();
        });

        this.recorder.ondataavailable = (event: BlobEvent) => {
            if (!event.data || event.data.size === 0 || this.discarded) {
                return;
            }
            this.chunks.push(event.data);
            this.bytes += event.data.size;
            if (this.maxBytes > 0 && this.bytes >= this.maxBytes * SIZE_LIMIT_HEADROOM) {
                this.triggerAutoStop('size-limit');
            }
        };

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
