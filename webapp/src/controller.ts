// Copyright (c) 2026-present Patika. All Rights Reserved.
// See LICENSE for license information.

import {
    canRecord,
    captureBrowserScreen,
    captureDesktopSource,
    captureMicrophone,
    isDesktopApp,
    listDesktopSources,
    stopStream,
    type DesktopSource,
} from './capture';
import {recordingFileName} from './media_format';
import {Recording, type AutoStopReason} from './recorder';

export type Phase = 'idle' | 'setup' | 'starting' | 'recording' | 'finishing';

export type State = {
    phase: Phase;
    isDesktop: boolean;
    sources: DesktopSource[] | null;
    selectedSourceId: string;
    includeMic: boolean;
    hasMic: boolean;
    micEnabled: boolean;
    startedAt: number;
    error: string;
    notice: string;
};

type UploadFn = (files: File[]) => void;

const MIC_PREFERENCE_KEY = 'dev.patika.screen-recorder.include-mic';

const initialState = (): State => ({
    phase: 'idle',
    isDesktop: false,
    sources: null,
    selectedSourceId: '',
    includeMic: readMicPreference(),
    hasMic: false,
    micEnabled: true,
    startedAt: 0,
    error: '',
    notice: '',
});

function readMicPreference(): boolean {
    try {
        return window.localStorage.getItem(MIC_PREFERENCE_KEY) !== 'false';
    } catch {
        return true;
    }
}

function writeMicPreference(value: boolean) {
    try {
        window.localStorage.setItem(MIC_PREFERENCE_KEY, String(value));
    } catch {
        // Private windows can refuse storage; the preference is only a convenience.
    }
}

const isMac = () => (/Mac/i).test(navigator.platform || navigator.userAgent);

export function describeError(err: unknown, desktop: boolean): string {
    const name = (err as {name?: string})?.name || '';
    if (name === 'NotAllowedError' || name === 'SecurityError' || (/permission/i).test(String((err as Error)?.message))) {
        if (desktop && isMac()) {
            return 'Screen recording is not allowed. On macOS open System Settings → Privacy & Security → Screen Recording, allow Mattermost, then quit and reopen the app.';
        }
        return 'Screen recording permission was denied.';
    }
    if (name === 'NotFoundError') {
        return 'No screen or window is available to record.';
    }
    if (name === 'NotReadableError') {
        return 'The screen could not be captured. Close other apps that are sharing the screen and try again.';
    }
    return `Recording failed: ${(err as Error)?.message || String(err)}`;
}

class Controller {
    private state: State = initialState();
    private readonly listeners = new Set<() => void>();
    private upload: UploadFn | null = null;
    private recording: Recording | null = null;
    private getMaxBytes: () => number = () => 0;

    configure(options: {getMaxBytes: () => number}) {
        this.getMaxBytes = options.getMaxBytes;
    }

    getState = (): State => this.state;

    subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    // Called from the attachment menu with the composer's own upload function, so the
    // video lands in the box the user clicked (channel or thread) as a normal attachment.
    open = (upload: UploadFn) => {
        if (this.state.phase !== 'idle') {
            return;
        }
        this.upload = upload;
        const desktop = isDesktopApp();
        this.set({...initialState(), phase: 'setup', isDesktop: desktop});

        if (!canRecord()) {
            this.set({error: 'This browser cannot record the screen. Use Chrome, Edge, Firefox, Safari or the Mattermost desktop app.'});
            return;
        }
        if (desktop) {
            listDesktopSources().then((sources) => {
                if (this.state.phase !== 'setup') {
                    return;
                }
                const screen = sources.find((s) => s.id.startsWith('screen:')) || sources[0];
                this.set({sources, selectedSourceId: screen?.id || ''});
                if (!sources.length) {
                    this.set({error: 'No screen or window is available to record.'});
                }
            }).catch((err) => this.set({sources: [], error: describeError(err, true)}));
        }
    };

    selectSource = (id: string) => this.set({selectedSourceId: id});

    setIncludeMic = (includeMic: boolean) => {
        writeMicPreference(includeMic);
        this.set({includeMic});
    };

    start = async () => {
        if (this.state.phase !== 'setup') {
            return;
        }
        const desktop = this.state.isDesktop;
        if (desktop && !this.state.selectedSourceId) {
            return;
        }
        this.set({phase: 'starting', error: ''});

        let screen: MediaStream;
        try {
            screen = desktop ? await captureDesktopSource(this.state.selectedSourceId) : await captureBrowserScreen();
        } catch (err) {
            if (!desktop && (err as {name?: string})?.name === 'NotAllowedError') {
                // Most often the user just closed the browser's picker.
                this.reset();
                return;
            }
            this.set({phase: 'setup', error: describeError(err, desktop)});
            return;
        }

        let mic: MediaStream | null = null;
        let notice = '';
        if (this.state.includeMic) {
            try {
                mic = await captureMicrophone();
            } catch {
                notice = 'Microphone unavailable — recording without sound.';
            }
        }

        try {
            this.recording = new Recording(screen, mic, this.getMaxBytes(), this.handleAutoStop);
            this.recording.start();
        } catch (err) {
            stopStream(screen);
            stopStream(mic);
            this.recording = null;
            this.set({phase: 'setup', error: describeError(err, desktop)});
            return;
        }
        this.set({phase: 'recording', startedAt: Date.now(), hasMic: Boolean(mic), micEnabled: true, notice});
    };

    toggleMic = () => {
        const micEnabled = !this.state.micEnabled;
        this.recording?.setMicEnabled(micEnabled);
        this.set({micEnabled});
    };

    stop = async (notice = '') => {
        const recording = this.recording;
        if (!recording || this.state.phase !== 'recording') {
            return;
        }
        this.set({phase: 'finishing'});
        try {
            const {blob, mimeType} = await recording.stop();
            if (blob.size > 0 && this.upload) {
                const file = new File([blob], recordingFileName(new Date(), mimeType), {type: blob.type || mimeType});
                this.upload([file]);
            }
            this.reset(notice);
        } catch (err) {
            this.reset(describeError(err, this.state.isDesktop));
        }
    };

    cancel = () => {
        this.recording?.cancel();
        this.reset();
    };

    dismissNotice = () => this.set({notice: ''});

    private handleAutoStop = (reason: AutoStopReason) => {
        if (reason === 'size-limit') {
            const mb = Math.round(this.getMaxBytes() / (1024 * 1024));
            this.stop(`Recording stopped at the ${mb} MB upload limit.`);
        } else {
            this.stop();
        }
    };

    private reset(notice = '') {
        this.recording = null;
        this.upload = null;
        this.set({...initialState(), notice});
    }

    private set(patch: Partial<State>) {
        this.state = {...this.state, ...patch};
        this.listeners.forEach((listener) => listener());
    }
}

export const controller = new Controller();
