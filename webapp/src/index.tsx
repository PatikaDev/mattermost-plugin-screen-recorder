// Copyright (c) 2026-present Patika. All Rights Reserved.
// See LICENSE for license information.

import manifest from 'manifest';
import React from 'react';
import type {Store} from 'redux';

import type {GlobalState} from '@mattermost/types/store';

import type {PluginRegistry} from 'types/mattermost-webapp';

import Root from './components/root';
import {controller} from './controller';

function RecordIcon() {
    return (
        <svg
            width='16'
            height='16'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
            aria-hidden='true'
        >
            <rect
                x='2'
                y='4'
                width='20'
                height='13'
                rx='2'
            />
            <path d='M8 21h8M12 17v4'/>
            <circle
                cx='12'
                cy='10.5'
                r='3'
                fill='currentColor'
            />
        </svg>
    );
}

export default class Plugin {
    public async initialize(registry: PluginRegistry, store: Store<GlobalState>) {
        controller.configure({

            // The server's upload limit; the recorder stops before a video would exceed it.
            getMaxBytes: () => parseInt(String(store.getState().entities.general.config.MaxFileSize || '0'), 10) || 0,
        });

        registry.registerRootComponent(Root);

        // The attachment menu passes the composer's own upload function, so the video is
        // added to that box (channel or thread reply) like any other attachment.
        registry.registerFileUploadMethod(
            <RecordIcon/>,
            (upload: (files: FileList | File[]) => void) => controller.open((files) => upload(files)),
            'Screen recording',
        );
    }
}

declare global {
    interface Window {
        registerPlugin(pluginId: string, plugin: Plugin): void;
    }
}

window.registerPlugin(manifest.id, new Plugin());
