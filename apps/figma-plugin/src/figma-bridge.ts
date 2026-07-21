import type { PluginMessageEnvelope, PluginToUiMessage, UiToPluginMessage } from "./messages";

export function isFigmaPlugin(): boolean {
  return window.parent !== window;
}

export function postToFigma(message: UiToPluginMessage): boolean {
  if (!isFigmaPlugin()) return false;
  window.parent.postMessage({ pluginMessage: message }, "*");
  return true;
}

export function subscribeToFigma(handler: (message: PluginToUiMessage) => void): () => void {
  const listener = (event: MessageEvent<PluginMessageEnvelope<PluginToUiMessage>>) => {
    const message = event.data?.pluginMessage;
    if (!message || ![
      "inserted",
      "inserted-in-frame",
      "replaced",
      "clipped",
      "error"
    ].includes(message.type)) return;
    handler(message);
  };
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}
