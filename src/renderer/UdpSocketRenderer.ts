import * as  EventEmitter from "eventemitter3";

import { Cloneable, RpcCall, RpcEvent, RpcResponse } from "../shared/Rpc.js";
import { UdpAddress, UdpBindOptions, UdpRemoteInfo } from "../shared/UdpTypes.js";

export interface UdpSocketRendererEvents {
  connect: () => void;
  close: () => void;
  listening: () => void;
  error: (err: Error) => void;
  message: (data: Uint8Array, rinfo: UdpRemoteInfo) => void;
}

export class UdpSocketRenderer extends EventEmitter<UdpSocketRendererEvents> {
  private _messagePort: MessagePort;
  private _callbacks = new Map<number, (result: Cloneable[]) => void>();
  private _nextCallId = 0;
  private _eventMap = new Map<string, (args: Cloneable[], ports?: readonly MessagePort[]) => void>([
    ["connect", () => this.emit("connect")],
    ["close", () => this.emit("close")],
    ["listening", () => this.emit("listening")],
    ["error", (args) => this.emit("error", new Error(args[0] as string))],
    ["message", (args) => this.emit("message", args[0] as Uint8Array, args[1] as UdpRemoteInfo)],
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
        const handler = this._eventMap.get(eventName);
        handler?.(args, ev.ports);
      }
    };
    messagePort.start();
  }

  async remoteAddress(): Promise<UdpAddress | undefined> {
    const res = await this._apiCall("remoteAddress");
    return res[0] as UdpAddress | undefined;
  }

  async localAddress(): Promise<UdpAddress | undefined> {
    const res = await this._apiCall("localAddress");
    return res[0] as UdpAddress | undefined;
  }

  async fd(): Promise<number | undefined> {
    const res = await this._apiCall("fd");
    return res[0] as number | undefined;
  }

  async addMembership(multicastAddress: string, multicastInterface?: string): Promise<void> {
    await this._apiCall("addMembership", multicastAddress, multicastInterface);
  }

  async addSourceSpecificMembership(
    sourceAddress: string,
    groupAddress: string,
    multicastInterface?: string,
  ): Promise<void> {
    await this._apiCall(
      "addSourceSpecificMembership",
      sourceAddress,
      groupAddress,
      multicastInterface,
    );
  }

  async bind(options: UdpBindOptions): Promise<void> {
    const res = await this._apiCall("bind", options);
    if (res[0] != undefined) {
      throw new Error(res[0] as string);
    }
  }

  async connect(port: number, address?: string): Promise<void> {
    const res = await this._apiCall("connect", port, address);
    if (res[0] != undefined) {
      throw new Error(res[0] as string);
    }
  }

  async close(): Promise<void> {
    await this._apiCall("close");
  }

  async disconnect(): Promise<void> {
    await this._apiCall("disconnect");
  }

  async dispose(): Promise<void> {
    await this._apiCall("dispose");
    this._messagePort.onmessage = null;
    this._messagePort.close();
    this._callbacks.clear();
  }

  async dropMembership(multicastAddress: string, multicastInterface?: string): Promise<void> {
    await this._apiCall("dropMembership", multicastAddress, multicastInterface);
  }

  async dropSourceSpecificMembership(
    sourceAddress: string,
    groupAddress: string,
    multicastInterface?: string,
  ): Promise<void> {
    await this._apiCall(
      "dropSourceSpecificMembership",
      sourceAddress,
      groupAddress,
      multicastInterface,
    );
  }

  async send(
    data: Uint8Array,
    offset?: number,
    length?: number,
    port?: number,
    address?: string,
    transfer = false,
  ): Promise<void> {
    return await new Promise((resolve) => {
      const callId = this._nextCallId++;
      this._callbacks.set(callId, () => {
        this._callbacks.delete(callId);
        resolve();
      });
      const msg: RpcCall = ["send", callId, data, offset, length, port, address];
      if (transfer) {
        this._messagePort.postMessage(msg, [data.buffer]);
      } else {
        this._messagePort.postMessage(msg);
      }
    });
  }

  async setBroadcast(flag: boolean): Promise<void> {
    await this._apiCall("setBroadcast", flag);
  }

  async setMulticastInterface(multicastInterface: string): Promise<void> {
    await this._apiCall("setMulticastInterface", multicastInterface);
  }

  async setMulticastLoopback(flag: boolean): Promise<void> {
    await this._apiCall("setMulticastLoopback", flag);
  }

  async setMulticastTTL(ttl: number): Promise<void> {
    await this._apiCall("setMulticastTTL", ttl);
  }

  async setRecvBufferSize(size: number): Promise<void> {
    await this._apiCall("setRecvBufferSize", size);
  }

  async setSendBufferSize(size: number): Promise<void> {
    await this._apiCall("setSendBufferSize", size);
  }

  async setTTL(ttl: number): Promise<void> {
    await this._apiCall("setTTL", ttl);
  }

  private async _apiCall(methodName: string, ...args: Cloneable[]): Promise<Cloneable[]> {
    return await new Promise((resolve) => {
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
