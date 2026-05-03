const api = typeof browser !== "undefined" ? browser : chrome;

const state = {
  enabled: false,
  captured: []
};

let badgeTimeoutId = null;

function buildDefaultFilename() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `websocket-capture-${timestamp}.json`;
}

function setIdleBadge() {
  if (!state.enabled) {
    api.browserAction.setBadgeText({ text: "" });
    return;
  }

  api.browserAction.setBadgeBackgroundColor({ color: "#2563eb" });
  api.browserAction.setBadgeText({ text: "ON" });
}

function flashTrafficBadge() {
  if (!state.enabled) {
    return;
  }

  if (badgeTimeoutId) {
    clearTimeout(badgeTimeoutId);
  }

  api.browserAction.setBadgeBackgroundColor({ color: "#16a34a" });
  api.browserAction.setBadgeText({ text: "●" });

  badgeTimeoutId = setTimeout(() => {
    badgeTimeoutId = null;
    setIdleBadge();
  }, 300);
}

async function notifyPopupState() {
  try {
    await api.runtime.sendMessage({
      type: "CAPTURE_STATE_UPDATED",
      enabled: state.enabled,
      captureCount: state.captured.length
    });
  } catch (_error) {
    // Ignore if popup is not open.
  }
}

async function broadcastToggle(enabled) {
  try {
    const tabs = await api.tabs.query({});
    await Promise.all(
      tabs
        .filter((tab) => typeof tab.id === "number")
        .map((tab) =>
          api.tabs
            .sendMessage(tab.id, { type: "STATE_CHANGED", enabled })
            .catch(() => undefined)
        )
    );
  } catch (_error) {
    // Ignore tab access failures.
  }
}

function toErrorMessage(error) {
  if (!error) {
    return "Unknown error";
  }
  return typeof error.message === "string" ? error.message : String(error);
}

async function exportCapturedData() {
  if (state.captured.length === 0) {
    return { ok: false, error: "No captured data to export." };
  }

  const blob = new Blob([JSON.stringify(state.captured, null, 2)], {
    type: "application/json"
  });
  const objectUrl = URL.createObjectURL(blob);

  try {
    await api.downloads.download({
      url: objectUrl,
      filename: buildDefaultFilename(),
      saveAs: true,
      conflictAction: "uniquify"
    });

    state.captured = [];
    await notifyPopupState();
    return { ok: true, captureCount: 0 };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
  }
}

async function init() {
  const saved = await api.storage.local.get("enabled");
  state.enabled = Boolean(saved.enabled);
  setIdleBadge();
}

api.runtime.onInstalled.addListener(() => {
  init().catch(() => undefined);
});

api.runtime.onStartup.addListener(() => {
  init().catch(() => undefined);
});

api.runtime.onMessage.addListener((message, sender) => {
  if (!message || typeof message.type !== "string") {
    return undefined;
  }

  if (message.type === "GET_STATE") {
    return Promise.resolve({
      enabled: state.enabled,
      captureCount: state.captured.length
    });
  }

  if (message.type === "SET_ENABLED") {
    state.enabled = Boolean(message.enabled);
    setIdleBadge();

    return api.storage.local.set({ enabled: state.enabled }).then(async () => {
      await broadcastToggle(state.enabled);
      await notifyPopupState();
      return {
        enabled: state.enabled,
        captureCount: state.captured.length
      };
    });
  }

  if (message.type === "WS_FRAME") {
    if (!state.enabled) {
      return Promise.resolve({ accepted: false, captureCount: state.captured.length });
    }

    const entry = {
      timestamp: new Date().toISOString(),
      tabId: sender && sender.tab ? sender.tab.id ?? null : null,
      pageUrl: sender && sender.tab ? sender.tab.url ?? message.pageUrl ?? null : message.pageUrl ?? null,
      direction: message.payload && message.payload.direction ? message.payload.direction : "unknown",
      socketUrl: message.payload && message.payload.socketUrl ? message.payload.socketUrl : null,
      payloadKind: message.payload && message.payload.payloadKind ? message.payload.payloadKind : "unknown",
      payload: message.payload && Object.prototype.hasOwnProperty.call(message.payload, "payload") ? message.payload.payload : null
    };

    state.captured.push(entry);
    flashTrafficBadge();

    return notifyPopupState().then(() => ({
      accepted: true,
      captureCount: state.captured.length
    }));
  }

  if (message.type === "EXPORT_DATA") {
    return exportCapturedData();
  }

  if (message.type === "CLEAR_DATA") {
    state.captured = [];
    setIdleBadge();
    return notifyPopupState().then(() => ({ ok: true, captureCount: 0 }));
  }

  return undefined;
});

init().catch(() => undefined);
