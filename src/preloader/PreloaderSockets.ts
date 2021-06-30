import { Cloneable, RpcCall } from "../shared/Rpc.js";
import { createHttpServer, createServer, createSocket } from "./api.js";

export class PreloaderSockets {
  // The preloader ("isolated world") side of the original message channel
  // connecting to the renderer ("main world"). Function calls such as
  // createSocket() and createServer() come in on this channel, and function
  // call return values are sent back over it
  private _messagePort: MessagePort;
  // The API exposed to the renderer
  private _functionHandlers = new Map<
    string,
    (callId: number, args: Cloneable[]) => void
  >([
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
          this._messagePort.postMessage([
            callId,
            `createSocket(${host}, ${port}) failed`,
          ]);
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
  ]);

  // A map of created `PreloaderSockets` instances
  static registeredSockets = new Map<string, PreloaderSockets>();

  constructor(messagePort: MessagePort) {
    this._messagePort = messagePort;

    messagePort.onmessage = (ev: MessageEvent<RpcCall>) => {
      const methodName = ev.data[0];
      const callId = ev.data[1];
      const handler = this._functionHandlers.get(methodName);
      if (handler == undefined) {
        this._messagePort.postMessage([
          callId,
          `unhandled method "${methodName}"`,
        ]);
        return;
      }

      const args = ev.data.slice(2);
      handler(callId, args);
    };
    messagePort.start();
  }

  static async Create(
    channel = "__electron_socket"
  ): Promise<PreloaderSockets> {
    const windowLoaded = new Promise<void>((resolve) => {
      if (document.readyState === "complete") {
        resolve();
        return;
      }
      const loaded = () => {
        window.removeEventListener("load", loaded);
        resolve();
      };
      window.addEventListener("load", loaded);
    });

    await windowLoaded;

    const entry = PreloaderSockets.registeredSockets.get(channel);
    if (entry != undefined) {
      return entry;
    }

    const messageChannel = new MessageChannel();
    const sockets = new PreloaderSockets(messageChannel.port2);
    PreloaderSockets.registeredSockets.set(channel, sockets);
    window.postMessage(channel, "*", [messageChannel.port1]);
    return sockets;
  }
}
