# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [1.0.2] — 2026-10-15

### Fixed
- No more duplicate icons and buttons after an upgrade: when Mattermost starts the plugin twice
  in an open window (it can, if the plugin is re-enabled while its code is still loading), the
  second start is ignored. Previously the page needed a reload to clear the duplicates.

## [1.0.1] — 2026-10-07

### Fixed
- "Screen recording" now lines up with "Your computer" in the attachment menu: it uses the
  same icon font (Font Awesome) and icon width as Mattermost's own entry, in light and dark themes.

## [1.0.0] — 2026-10-07

### Added
- 📎 **Screen recording** in every message box (channel and thread reply); the video is
  added to that box as a normal attachment.
- Screen or window selection: built-in picker with thumbnails in the desktop app, the
  browser's own picker elsewhere.
- Optional microphone narration with mute/unmute while recording.
- MP4 recording with automatic WebM fallback; duration written into WebM files.
- Automatic stop at the server's upload limit, and when sharing is ended from the
  browser or OS.
- Capture capped at 1920×1080.
- One build for Mattermost 10.11+, verified on 11.7 and 12.0.
