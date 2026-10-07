# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

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
