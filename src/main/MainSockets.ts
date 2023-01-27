import { ipcMain, MessageChannelMain } from "electron";
import { createHttpServer, createServer, createSocket, createUdpSocket } from "../preloader/api.js";
import { ConvertToMessagePort, MessageChannelLike, MessagePortLike } from "../shared/MessagePort.js";
import { Cloneable, RpcCall } from "../shared/Rpc.js";

function messageChannelFactoryMain(): MessageChannelLike {
  return (new MessageChannelMain() as unknown) as MessageChannelLike;
}

export class MainSockets {
  // The preloader ("isolated world") side of the original message channel
  // connecting to the renderer ("main world"). Function calls such as
  // createSocket() and createServer() come in on this channel, and function
  // call return values are sent back over it
  private _messagePort: MessagePortLike;
  // The API exposed to the renderer
  private _functionHandlers = new Map<string, (callId: number, args: Cloneable[]) => void>([
    [
      "createHttpServer",
      (callId, _) => {
        const port = createHttpServer(messageChannelFactoryMain);
        this._messagePort.postMessage([callId], [port]);
      },
    ],
    [
      "createSocket",
      (callId, args) => {
        const host = args[0] as string;
        const port = args[1] as number;
        const msgPort = createSocket(messageChannelFactoryMain, host, port);
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
        const msgPort = createServer(messageChannelFactoryMain);
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
        const msgPort = createUdpSocket(messageChannelFactoryMain);
        if (msgPort == undefined) {
          this._messagePort.postMessage([callId, `createUdpSocket() failed`]);
        } else {
          this._messagePort.postMessage([callId], [msgPort]);
        }
      },
    ],
  ]);

  // A map of created `MainSockets` instances
  static registeredSockets = new Map<string, MainSockets>();

  constructor(messagePort: MessagePortLike) {
    this._messagePort = messagePort;

    messagePort.addEventListener('message', (ev: MessageEvent<RpcCall>) => {
      const methodName = ev.data[0];
      const callId = ev.data[1];
      const handler = this._functionHandlers.get(methodName);
      if (handler == undefined) {
        this._messagePort.postMessage([callId, `unhandled method "${methodName}"`]);
        return;
      }

      const args = ev.data.slice(2);
      handler(callId, args);
    });
    messagePort.start();
  }

  static async Init() {
    ipcMain.on('__electron_socket_main', (event, channel) => {
      // const sockets = MainSockets.registeredSockets.get(channel);
      // if (sockets) {
      //   return;
      // }
      const messageChannel = new MessageChannelMain();
      const newSockets = new MainSockets(ConvertToMessagePort(messageChannel.port2));
      newSockets;
      // MainSockets.registeredSockets.set(channel, newSockets);
      event.sender.postMessage(channel, '', [messageChannel.port1]);
    });
  }
}
