// Copyright (c) 2026-present Patika. All Rights Reserved.
// See LICENSE for license information.

import manifest from 'manifest';
import React from 'react';
import type {Store} from 'redux';

import type {GlobalState} from '@mattermost/types/store';

import type {PluginRegistry} from 'types/mattermost-webapp';

import Root from './components/root';
import {controller} from './controller';

// Same icon font as Mattermost's own "Your computer" item (Font Awesome 4, `fa fa-laptop`,
// present on 10.11, 11.x and 12.x) and the same box width as that laptop glyph, so the
// labels in the attachment menu line up exactly.
function RecordIcon() {
    return (
        <i
            className='fa fa-desktop'
            style={{width: '1.0714em', textAlign: 'center'}}
            aria-hidden='true'
        />
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
