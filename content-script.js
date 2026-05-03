const api = typeof browser !== "undefined" ? browser : chrome;
const PAGE_EVENT_NAME = "__WS_MONITOR_EVENT__";
const PAGE_CONTROL_EVENT_NAME = "__WS_MONITOR_CONTROL__";

let hookInjected = false;

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

function forwardPageEvent(event) {
  if (!event || !event.detail) {
    return;
  }

  api.runtime
    .sendMessage({
      type: "WS_FRAME",
      pageUrl: window.location.href,
      payload: event.detail
    })
    .catch(() => undefined);
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
