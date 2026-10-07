# Contributing

Thanks for helping! Issues and pull requests are welcome.

## Before you open a pull request

```bash
cd webapp && npm ci && npm run lint && npm run check-types && npm test
cd .. && make dist
cd e2e && npm ci && MM_VERSION=11.7.11 ./scripts/start-server.sh && npx playwright test
```

CI runs the same checks, plus the end-to-end suite on every supported Mattermost line.

## Compatibility rules

The plugin uses the **server's** React at runtime — React 17 on Mattermost 10.11, 18 on 11.x,
19 on 12.x — so one build has to work on all of them:

- Keep `@babel/preset-react` on the **classic** JSX runtime. The automatic runtime needs
  `window.ReactJSXRuntime`, which only Mattermost 12 provides.
- Use function components and hooks available since React 16.8. Avoid `defaultProps` on
  function components, string refs, legacy context, `findDOMNode`, `ReactDOM.render`,
  `useId` and `useSyncExternalStore`.
- Don't import `prop-types`, `react-bootstrap` or `react-router-dom`.

## Testing on the desktop app

Screen capture in the Mattermost desktop app goes through `window.desktopAPI.getDesktopSources()`
and `getUserMedia({chromeMediaSource: 'desktop'})`; it cannot be automated in CI. If you change
`src/capture.ts` or `src/recorder.ts`, please record once in the desktop app (macOS or Windows)
and mention it in the pull request.
