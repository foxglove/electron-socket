import * as net from "net";

import { Cloneable, RpcCall, RpcHandler, RpcResponse } from "../shared/Rpc.js";
import { TcpAddress } from "../shared/TcpTypes.js";
import { TcpSocketElectron } from "./TcpSocketElectron.js";
import { nextId, registerEntity } from "./registry.js";
import { ConvertToMessagePort, MessageChannelFactory, MessagePortLike } from "../shared/MessagePort.js";

export class TcpServerElectron {
  readonly id: number;
  readonly messageChannelFactory: MessageChannelFactory;
  private _server: net.Server;
  private _messagePort: MessagePortLike;
  private _api = new Map<string, RpcHandler>([
    ["address", (callId) => this._apiResponse([callId, this.address()])],
    [
      "listen",
      (callId, args) => {
        const port = args[0] as number | undefined;
        const hostname = args[1] as string | undefined;
        const backlog = args[2] as number | undefined;
        this.listen(port, hostname, backlog)
          .then(() => this._apiResponse([callId, undefined]))
          .catch((err: Error) => this._apiResponse([callId, String(err.stack ?? err)]));
      },
    ],
    ["close", (callId) => this._apiResponse([callId, this.close()])],
    ["dispose", (callId) => this._apiResponse([callId, this.dispose()])],
  ]);

  constructor(messageChannelFactory: MessageChannelFactory, id: number, messagePort: MessagePortLike) {
    this.messageChannelFactory = messageChannelFactory;
    this.id = id;
    this._server = net.createServer();
    this._messagePort = messagePort;

    this._server.on("close", () => this._emit("close"));
    this._server.on("connection", (socket) => this._emitConnection(socket));
    this._server.on("error", (err) => this._emit("error", String(err.stack ?? err)));

    messagePort.addEventListener('message', (ev: MessageEvent<RpcCall>) => {
      const [methodName, callId, ...args] = ev.data;
      const handler = this._api.get(methodName);
      handler?.(callId, args);
    });
    messagePort.start();
  }

  address(): TcpAddress | undefined {
    const addr = this._server.address();
    if (addr == undefined || typeof addr === "string") {
      // Address will only be a string for an IPC (named pipe) server, which
      // should never happen here
      return undefined;
    }
    return addr;
  }

  async listen(port?: number, hostname?: string, backlog?: number): Promise<void> {
    return await new Promise((resolve, reject) => {
      this._server.listen(port, hostname, backlog, () => {
        this._server.removeListener("error", reject);
        resolve();
      });
    });
  }

  close(): void {
    this._server.close();
  }

  dispose(): void {
    this._server.removeAllListeners();
    this.close();
    this._messagePort.close();
  }

  private _apiResponse(message: RpcResponse, transfer?: Transferable[]): void {
    if (transfer != undefined) {
      this._messagePort.postMessage(message, transfer);
    } else {
      this._messagePort.postMessage(message);
    }
  }

  private _emit(eventName: string, ...args: Cloneable[]): void {
    const msg = [eventName, ...args];
    this._messagePort.postMessage(msg);
  }

  private _emitConnection(socket: net.Socket): void {
    const id = nextId();
    const channel = this.messageChannelFactory();
    const electronSocket = new TcpSocketElectron(this.messageChannelFactory, id, ConvertToMessagePort(channel.port2), socket);
    registerEntity(id, electronSocket);
    this._messagePort.postMessage(["connection"], [channel.port1]);
  }
}
