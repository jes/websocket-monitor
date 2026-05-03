const api = typeof browser !== "undefined" ? browser : chrome;
const PAGE_EVENT_NAME = "__WS_MONITOR_EVENT__";
const PAGE_CONTROL_EVENT_NAME = "__WS_MONITOR_CONTROL__";
const MAX_MESSAGE_CHARS = 48 * 1024;

let hookInjected = false;
let frameSequence = 0;
let sendQueue = Promise.resolve();

function nextFrameId() {
  frameSequence += 1;
  return `${Date.now()}-${frameSequence}-${Math.random().toString(16).slice(2, 10)}`;
}

function sendControlEvent(enabled) {
  window.dispatchEvent(
    new CustomEvent(PAGE_CONTROL_EVENT_NAME, {
      detail: { enabled: Boolean(enabled) }
    })
  );
}

function injectHookScript() {
  if (hookInjected) {
    return;
  }

  const parent = document.head || document.documentElement;
  if (!parent) {
    window.requestAnimationFrame(injectHookScript);
    return;
  }

  const script = document.createElement("script");
  script.src = api.runtime.getURL("page-hook.js");
  script.async = false;

  parent.appendChild(script);
  script.remove();

  hookInjected = true;
  sendControlEvent(true);
}

async function sendChunkedTextFrame(detail) {
  const payload = detail.payload;
  const chunkCount = Math.ceil(payload.length / MAX_MESSAGE_CHARS);
  const frameId = nextFrameId();

  for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
    const start = chunkIndex * MAX_MESSAGE_CHARS;
    const end = start + MAX_MESSAGE_CHARS;

    await api.runtime.sendMessage({
      type: "WS_FRAME_CHUNK",
      frameId,
      chunkIndex,
      chunkCount,
      pageUrl: window.location.href,
      direction: detail.direction || "unknown",
      socketUrl: detail.socketUrl || null,
      payloadKind: detail.payloadKind || "text",
      chunk: payload.slice(start, end)
    });
  }
}

async function sendFrame(detail) {
  const isLargeTextPayload =
    detail &&
    detail.payloadKind === "text" &&
    typeof detail.payload === "string" &&
    detail.payload.length > MAX_MESSAGE_CHARS;

  if (isLargeTextPayload) {
    await sendChunkedTextFrame(detail);
    return;
  }

  await api.runtime.sendMessage({
    type: "WS_FRAME",
    pageUrl: window.location.href,
    payload: detail
  });
}

function forwardPageEvent(event) {
  if (!event || !event.detail) {
    return;
  }

  sendQueue = sendQueue.then(() => sendFrame(event.detail)).catch(() => undefined);
}

window.addEventListener(PAGE_EVENT_NAME, forwardPageEvent, false);

api.runtime.onMessage.addListener((message) => {
  if (!message || message.type !== "STATE_CHANGED") {
    return undefined;
  }

  if (hookInjected) {
    sendControlEvent(Boolean(message.enabled));
  }

  return undefined;
});

api.runtime
  .sendMessage({ type: "GET_STATE" })
  .then((state) => {
    if (state && state.enabled) {
      injectHookScript();
    }
  })
  .catch(() => undefined);
