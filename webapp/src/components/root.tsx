// Copyright (c) 2026-present Patika. All Rights Reserved.
// See LICENSE for license information.

import React, {useEffect, useState} from 'react';

import {controller, type State} from '../controller';
import {formatDuration} from '../media_format';

import '../styles.css';

// Only hooks available since React 16.8: the host webapp's React is used at runtime
// (17 on Mattermost 10.11, 18 on 11.x, 19 on 12.x).
function useControllerState(): State {
    const [state, setState] = useState<State>(controller.getState());
    useEffect(() => controller.subscribe(() => setState(controller.getState())), []);
    return state;
}

function useNow(active: boolean): number {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        if (!active) {
            return undefined;
        }
        const timer = window.setInterval(() => setNow(Date.now()), 500);
        return () => window.clearInterval(timer);
    }, [active]);
    return now;
}

function SetupDialog({state}: {state: State}) {
    const starting = state.phase === 'starting';
    const loadingSources = state.isDesktop && state.sources === null && !state.error;
    const canStart = !starting && !loadingSources && (!state.isDesktop || Boolean(state.selectedSourceId));

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                controller.cancel();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, []);

    return (
        <div className='sr-overlay'>
            <div
                className='sr-dialog'
                role='dialog'
                aria-modal='true'
                aria-labelledby='sr-dialog-title'
            >
                <h2 id='sr-dialog-title'>{'Screen recording'}</h2>

                {state.isDesktop ? (
                    <div className='sr-sources'>
                        {loadingSources && <p className='sr-muted'>{'Looking for screens and windows…'}</p>}
                        {(state.sources || []).map((source) => (
                            <button
                                key={source.id}
                                type='button'
                                className={`sr-source${source.id === state.selectedSourceId ? ' sr-source--selected' : ''}`}
                                onClick={() => controller.selectSource(source.id)}
                                aria-pressed={source.id === state.selectedSourceId}
                            >
                                <img
                                    src={source.thumbnailURL}
                                    alt=''
                                />
                                <span>{source.name}</span>
                            </button>
                        ))}
                    </div>
                ) : (
                    <p className='sr-muted'>{'Your browser will ask which screen, window or tab to record.'}</p>
                )}

                <label className='sr-check'>
                    <input
                        type='checkbox'
                        checked={state.includeMic}
                        onChange={(e) => controller.setIncludeMic(e.target.checked)}
                    />
                    <span>{'Include microphone narration'}</span>
                </label>

                {state.error && <p className='sr-error'>{state.error}</p>}

                <div className='sr-actions'>
                    <button
                        type='button'
                        className='btn btn-tertiary'
                        onClick={controller.cancel}
                    >
                        {'Cancel'}
                    </button>
                    <button
                        type='button'
                        className='btn btn-primary'
                        disabled={!canStart}
                        onClick={controller.start}
                    >
                        {starting ? 'Starting…' : 'Start recording'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function RecordingBar({state}: {state: State}) {
    const finishing = state.phase === 'finishing';
    const now = useNow(!finishing);

    return (
        <div
            className='sr-bar'
            role='status'
        >
            <span
                className='sr-dot'
                aria-hidden='true'
            />
            <span className='sr-bar__label'>{finishing ? 'Preparing video…' : 'Recording'}</span>
            <span className='sr-bar__time'>{formatDuration(now - state.startedAt)}</span>
            {state.hasMic && (
                <button
                    type='button'
                    className='btn btn-sm btn-tertiary'
                    onClick={controller.toggleMic}
                    disabled={finishing}
                >
                    {state.micEnabled ? 'Mute mic' : 'Unmute mic'}
                </button>
            )}
            <button
                type='button'
                className='btn btn-sm btn-tertiary'
                onClick={controller.cancel}
                disabled={finishing}
            >
                {'Cancel'}
            </button>
            <button
                type='button'
                className='btn btn-sm btn-primary'
                onClick={() => controller.stop()}
                disabled={finishing}
            >
                {'Stop'}
            </button>
        </div>
    );
}

function Notice({text}: {text: string}) {
    useEffect(() => {
        const timer = window.setTimeout(controller.dismissNotice, 8000);
        return () => window.clearTimeout(timer);
    }, [text]);

    return (
        <div
            className='sr-notice'
            role='status'
        >
            <span>{text}</span>
            <button
                type='button'
                className='sr-notice__close'
                aria-label='Dismiss'
                onClick={controller.dismissNotice}
            >
                {'×'}
            </button>
        </div>
    );
}

export default function Root() {
    const state = useControllerState();

    return (
        <>
            {(state.phase === 'setup' || state.phase === 'starting') && <SetupDialog state={state}/>}
            {(state.phase === 'recording' || state.phase === 'finishing') && <RecordingBar state={state}/>}
            {state.notice && state.phase !== 'setup' && <Notice text={state.notice}/>}
        </>
    );
}
