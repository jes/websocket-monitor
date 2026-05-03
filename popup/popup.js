const api = typeof browser !== "undefined" ? browser : chrome;

const statusLine = document.getElementById("status-line");
const countLine = document.getElementById("count-line");
const refreshNote = document.getElementById("refresh-note");
const messageLine = document.getElementById("message-line");
const toggleButton = document.getElementById("toggle-button");
const exportButton = document.getElementById("export-button");
const clearButton = document.getElementById("clear-button");

let currentEnabled = false;
let currentCount = 0;

function setMessage(text, isError) {
  messageLine.textContent = text || "";
  messageLine.style.color = isError ? "#fca5a5" : "#cbd5e1";
}

function render() {
  statusLine.textContent = `Status: ${currentEnabled ? "active" : "inactive"}`;
  countLine.textContent = `Captured frames: ${currentCount}`;
  refreshNote.hidden = !currentEnabled;
  toggleButton.textContent = currentEnabled ? "Disable capture" : "Enable capture";
  exportButton.disabled = currentCount === 0;
  clearButton.disabled = currentCount === 0;
}

async function refreshState() {
  const state = await api.runtime.sendMessage({ type: "GET_STATE" });
  currentEnabled = Boolean(state.enabled);
  currentCount = Number(state.captureCount || 0);
  render();
}

toggleButton.addEventListener("click", async () => {
  toggleButton.disabled = true;
  try {
    const nextEnabled = !currentEnabled;
    const state = await api.runtime.sendMessage({
      type: "SET_ENABLED",
      enabled: nextEnabled
    });

    currentEnabled = Boolean(state.enabled);
    currentCount = Number(state.captureCount || 0);
    render();

    if (currentEnabled) {
      setMessage("Capture enabled. Refresh target pages to start capturing.", false);
    } else {
      setMessage("Capture disabled.", false);
    }
  } catch (error) {
    setMessage(`Failed to toggle capture: ${error.message || String(error)}`, true);
  } finally {
    toggleButton.disabled = false;
  }
});

exportButton.addEventListener("click", async () => {
  exportButton.disabled = true;
  setMessage("Opening file save dialog...", false);

  try {
    const result = await api.runtime.sendMessage({ type: "EXPORT_DATA" });
    if (!result || !result.ok) {
      setMessage((result && result.error) || "Export failed.", true);
      return;
    }

    currentCount = 0;
    render();
    setMessage("Export complete. In-memory capture cleared.", false);
  } catch (error) {
    setMessage(`Export failed: ${error.message || String(error)}`, true);
  } finally {
    exportButton.disabled = currentCount === 0;
  }
});

clearButton.addEventListener("click", async () => {
  clearButton.disabled = true;
  try {
    const result = await api.runtime.sendMessage({ type: "CLEAR_DATA" });
    currentCount = Number((result && result.captureCount) || 0);
    render();
    setMessage("Cleared in-memory capture.", false);
  } catch (error) {
    setMessage(`Failed to clear data: ${error.message || String(error)}`, true);
  } finally {
    clearButton.disabled = currentCount === 0;
  }
});

api.runtime.onMessage.addListener((message) => {
  if (!message || message.type !== "CAPTURE_STATE_UPDATED") {
    return undefined;
  }

  currentEnabled = Boolean(message.enabled);
  currentCount = Number(message.captureCount || 0);
  render();
  return undefined;
});

refreshState().catch((error) => {
  setMessage(`Could not read extension state: ${error.message || String(error)}`, true);
});
