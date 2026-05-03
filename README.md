# WebSocket Capture Monitor (Firefox Extension)

A minimal Firefox WebExtension that:

- starts **inactive** by default,
- captures WebSocket frames only when enabled,
- exposes toolbar popup controls to enable/disable capture,
- exports captured data to JSON via Firefox's save dialog (`saveAs: true`),
- clears in-memory capture immediately after successful export.

## Load in Firefox

1. Open Firefox and go to `about:debugging`.
2. Click **This Firefox**.
3. Click **Load Temporary Add-on...**.
4. Select `manifest.json` from this folder.

## Use

1. Click the extension toolbar button.
2. Press **Enable capture**.
3. Refresh the page(s) you want to monitor.
4. Perform actions that generate WebSocket traffic.
5. Click **Export JSON** and choose your target file/location.
6. Capture memory is cleared after export so you can repeat for the next product/page.

## Notes

- The toolbar badge shows:
  - `ON` while capture is enabled.
  - a brief `●` flash when traffic is seen.
- Captures include direction (`inbound`/`outbound`), page URL, socket URL, timestamp, and payload.
- Text payload captures include `payloadLength` so you can verify full frame size.
- Binary payloads are serialized as base64.
- Blob payloads are recorded as metadata (`type`, `size`) in this basic version.
- Large text frames are chunked between content script and background to avoid extension message-size limits, then reassembled before export.
