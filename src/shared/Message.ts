/** A message sent between the preloader & renderer using `window.postMessage()`. */
export type Message = {
  channel: string;
  type: "rendererReady" | "preloaderReady" | "preloaderInitialized";
};
