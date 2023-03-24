import { createHttpServer, createServer, createSocket, createUdpSocket } from "./api.js";
import { Message } from "../shared/Message.js";
import { Cloneable, RpcCall } from "../shared/Rpc.js";

export class PreloaderSockets {
  // The preloader ("isolated world") side of the original message channel
  // connecting to the renderer ("main world"). Function calls such as
  // createSocket() and createServer() come in on this channel, and function
  // call return values are sent back over it
  private _messagePort: MessagePort;
  // The API exposed to the renderer
  private _functionHandlers = new Map<string, (callId: number, args: Cloneable[]) => void>([
    [
      "createHttpServer",
      (callId, _) => {
        const port = createHttpServer();
        this._messagePort.postMessage([callId], [port]);
      },
    ],
    [
      "createSocket",
      (callId, args) => {
        const host = args[0] as string;
        const port = args[1] as number;
        const msgPort = createSocket(host, port);
        if (msgPort == undefined) {
          this._messagePort.postMessage([callId, `createSocket(${host}, ${port}) failed`]);
        } else {
          this._messagePort.postMessage([callId], [msgPort]);
        }
      },
    ],
    [
      "createServer",
      (callId, _args) => {
        const msgPort = createServer();
        if (msgPort == undefined) {
          this._messagePort.postMessage([callId, `createServer() failed`]);
        } else {
          this._messagePort.postMessage([callId], [msgPort]);
        }
      },
    ],
    [
      "createUdpSocket",
      (callId, _args) => {
        const msgPort = createUdpSocket();
        if (msgPort == undefined) {
          this._messagePort.postMessage([callId, `createUdpSocket() failed`]);
        } else {
          this._messagePort.postMessage([callId], [msgPort]);
        }
      },
    ],
  ]);

  // A map of created `PreloaderSockets` instances
  /** @deprecated Use `Create()` rather than accessing `registeredSockets` directly */
  static registeredSockets = new Map<string, PreloaderSockets>();
  static #registeredSocketPromises = new Map<string, Promise<PreloaderSockets>>();

  constructor(messagePort: MessagePort) {
    this._messagePort = messagePort;

    messagePort.onmessage = (ev: MessageEvent<RpcCall>) => {
      const methodName = ev.data[0];
      const callId = ev.data[1];
      const handler = this._functionHandlers.get(methodName);
      if (handler == undefined) {
        this._messagePort.postMessage([callId, `unhandled method "${methodName}"`]);
        return;
      }

      const args = ev.data.slice(2);
      handler(callId, args);
    };
    messagePort.start();
  }

  // Initialize electron-socket on the preloader side. This method will not resolve until the
  // renderer side has also been initialized.
  static async Create(channel = "__electron_socket"): Promise<PreloaderSockets> {
    const entry = PreloaderSockets.#registeredSocketPromises.get(channel);
    if (entry) {
      return await entry;
    }

    const promise = new Promise<PreloaderSockets>((resolve) => {
      const initializeSockets = () => {
        const messageChannel = new MessageChannel();
        const sockets = new PreloaderSockets(messageChannel.port2);
        PreloaderSockets.registeredSockets.set(channel, sockets);
        window.postMessage(
          {
            channel,
            type: "preloaderInitialized",
          } satisfies Message,
          "*",
          [messageChannel.port1],
        );
        resolve(sockets);
      };

      const messageListener = (event: MessageEvent<Message>) => {
        if (event.target !== window || event.data.channel !== channel) {
          return;
        }
        if (event.data.type === "rendererReady") {
          initializeSockets();
          window.removeEventListener("message", messageListener);
        }
      };
      window.addEventListener("message", messageListener);

      // Notify the renderer that we are ready to initialize.
      // - If it has not yet invoked Create(), it will send a rendererReady message when it does.
      // - If the renderer has already invoked Create(), it will re-send its rendererReady message.
      window.postMessage({ channel, type: "preloaderReady" } satisfies Message, "*");
    });
    PreloaderSockets.#registeredSocketPromises.set(channel, promise);
    return await promise;
  }
}
