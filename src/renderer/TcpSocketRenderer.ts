import EventEmitter from "eventemitter3";

import { Cloneable, RpcCall, RpcEvent, RpcResponse } from "../shared/Rpc.js";
import { TcpAddress } from "../shared/TcpTypes.js";

export interface TcpSocketRendererEvents {
  connect: () => void;
  close: () => void;
  end: () => void;
  timeout: () => void;
  error: (err: Error) => void;
  data: (data: Uint8Array) => void;
}

export class TcpSocketRenderer extends EventEmitter<TcpSocketRendererEvents> {
  private _messagePort: MessagePort;
  private _callbacks = new Map<number, (result: Cloneable[]) => void>();
  private _nextCallId = 0;
  private _events = new Map<string, (args: Cloneable[], ports?: readonly MessagePort[]) => void>([
    ["connect", () => this.emit("connect")],
    ["close", () => this.emit("close")],
    ["end", () => this.emit("end")],
    ["timeout", () => this.emit("timeout")],
    ["error", (args) => this.emit("error", new Error(args[0] as string))],
    ["data", (args) => this.emit("data", args[0] as Uint8Array)],
  ]);

  constructor(messagePort: MessagePort) {
    super();
    this._messagePort = messagePort;

    messagePort.onmessage = (ev: MessageEvent<RpcResponse | RpcEvent>) => {
      const args = ev.data.slice(1);
      if (typeof ev.data[0] === "number") {
        // RpcResponse
        const callId = ev.data[0];
        const callback = this._callbacks.get(callId);
        if (callback != undefined) {
          this._callbacks.delete(callId);
          callback(args);
        }
      } else {
        // RpcEvent
        const eventName = ev.data[0];
        const handler = this._events.get(eventName);
        handler?.(args, ev.ports);
      }
    };
    messagePort.start();
  }

  async remoteAddress(): Promise<TcpAddress | undefined> {
    const res = await this._apiCall("remoteAddress");
    return res[0] as TcpAddress | undefined;
  }

  async localAddress(): Promise<TcpAddress | undefined> {
    const res = await this._apiCall("localAddress");
    return res[0] as TcpAddress | undefined;
  }

  async fd(): Promise<number | undefined> {
    const res = await this._apiCall("fd");
    return res[0] as number | undefined;
  }

  async setKeepAlive(enable?: boolean, initialDelay?: number): Promise<void> {
    await this._apiCall("setKeepAlive", enable, initialDelay);
  }

  async setTimeout(timeout: number): Promise<void> {
    await this._apiCall("setTimeout", timeout);
  }

  async setNoDelay(noDelay?: boolean): Promise<void> {
    await this._apiCall("setNoDelay", noDelay);
  }

  async connected(): Promise<boolean> {
    const res = await this._apiCall("connected");
    return res[0] as boolean;
  }

  async connect(): Promise<void> {
    const res = await this._apiCall("connect");
    if (res[0] != undefined) {
      throw new Error(res[0] as string);
    }
  }

  async close(): Promise<void> {
    await this._apiCall("close");
  }

  async dispose(): Promise<void> {
    await this._apiCall("dispose");
    this._messagePort.onmessage = null;
    this._messagePort.close();
    this._callbacks.clear();
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  write(data: Uint8Array, transfer = true): Promise<void> {
    return new Promise((resolve) => {
      const callId = this._nextCallId++;
      this._callbacks.set(callId, () => {
        this._callbacks.delete(callId);
        resolve();
      });
      const msg: RpcCall = ["write", callId, data];
      if (transfer) {
        this._messagePort.postMessage(msg, [data.buffer]);
      } else {
        this._messagePort.postMessage(msg);
      }
    });
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  private _apiCall(methodName: string, ...args: Cloneable[]): Promise<Cloneable[]> {
    return new Promise((resolve) => {
      const callId = this._nextCallId++;
      this._callbacks.set(callId, (result) => {
        this._callbacks.delete(callId);
        resolve(result);
      });
      const msg: RpcCall = [methodName, callId, ...args];
      this._messagePort.postMessage(msg);
    });
  }
}
