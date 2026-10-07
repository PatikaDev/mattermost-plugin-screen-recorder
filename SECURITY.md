# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Use GitHub's
[private vulnerability reporting](https://github.com/PatikaDev/mattermost-plugin-screen-recorder/security/advisories/new)
for this repository instead. We aim to acknowledge reports within 5 working days.

## Scope

This plugin runs only in the Mattermost web and desktop clients; it has no server-side
component. Recordings stay in the user's browser or desktop app until the user sends them,
and are then uploaded through Mattermost's normal file-upload API.

## Supported versions

Security fixes are released for the latest minor version.
