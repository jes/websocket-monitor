(function () {
  if (window.__WS_MONITOR_HOOK_INSTALLED__) {
    return;
  }
  window.__WS_MONITOR_HOOK_INSTALLED__ = true;

  const PAGE_EVENT_NAME = "__WS_MONITOR_EVENT__";
  const PAGE_CONTROL_EVENT_NAME = "__WS_MONITOR_CONTROL__";
  const NativeWebSocket = window.WebSocket;
  const nativeSend = NativeWebSocket.prototype.send;
  const monitoredSockets = new WeakSet();

  let captureEnabled = true;

  function emitCapture(payload) {
    if (!captureEnabled) {
      return;
    }

    window.dispatchEvent(
      new CustomEvent(PAGE_EVENT_NAME, {
        detail: payload
      })
    );
  }

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = "";

    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }

    return btoa(binary);
  }

  function serializePayload(data) {
    if (typeof data === "string") {
      return { payloadKind: "text", payload: data };
    }

    if (data instanceof ArrayBuffer) {
      return { payloadKind: "arraybuffer-base64", payload: arrayBufferToBase64(data) };
    }

    if (ArrayBuffer.isView(data)) {
      return {
        payloadKind: "typedarray-base64",
        payload: arrayBufferToBase64(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength))
      };
    }

    if (data instanceof Blob) {
      return {
        payloadKind: "blob-metadata",
        payload: {
          type: data.type || "application/octet-stream",
          size: data.size
        }
      };
    }

    try {
      return { payloadKind: "json", payload: JSON.stringify(data) };
    } catch (_error) {
      return { payloadKind: typeof data, payload: String(data) };
    }
  }

  function capture(direction, socketUrl, data) {
    const serialized = serializePayload(data);
    emitCapture({
      direction,
      socketUrl: socketUrl || null,
      payloadKind: serialized.payloadKind,
      payload: serialized.payload
    });
  }

  function ensureInboundListener(ws, fallbackUrl) {
    if (!ws || monitoredSockets.has(ws)) {
      return;
    }

    ws.addEventListener("message", (event) => {
      capture("inbound", ws.url || fallbackUrl || null, event.data);
    });

    monitoredSockets.add(ws);
  }

  function PatchedWebSocket(url, protocols) {
    const ws =
      arguments.length > 1
        ? new NativeWebSocket(url, protocols)
        : new NativeWebSocket(url);

    ensureInboundListener(ws, url);

    return ws;
  }

  PatchedWebSocket.prototype = NativeWebSocket.prototype;
  Object.setPrototypeOf(PatchedWebSocket, NativeWebSocket);

  NativeWebSocket.prototype.send = function patchedSend(data) {
    // Helps attach inbound capture for sockets that existed before hook injection.
    ensureInboundListener(this, this.url || null);
    capture("outbound", this.url, data);
    return nativeSend.apply(this, arguments);
  };

  window.WebSocket = PatchedWebSocket;

  window.addEventListener(
    PAGE_CONTROL_EVENT_NAME,
    (event) => {
      captureEnabled = Boolean(event && event.detail && event.detail.enabled);
    },
    false
  );
})();
