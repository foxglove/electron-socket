/* eslint-disable @typescript-eslint/no-empty-function */

import { createSocket, SocketOptions } from "dgram";

import { UdpSocketElectron } from "./UdpSocketElectron";
import { RpcCall } from "../shared/Rpc";
import { UdpRemoteInfo } from "../shared/UdpTypes";

class MessagePort {
  onmessage = (_ev: MessageEvent<RpcCall>) => {};
  onmessageerror = (_ev: MessageEvent<unknown>) => {};

  start() {}
  postMessage() {}
  close() {}

  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() {
    return false;
  }
}

const PORT1 = 37856;
const PORT2 = 37857;
const SOCKET_OPTS: SocketOptions = { type: "udp4", reuseAddr: true };

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
}

describe("UdpSocketElectron", () => {
  it("can send and receive data", async () => {
    const socket1 = new UdpSocketElectron(0, new MessagePort(), createSocket(SOCKET_OPTS));
    const socket2 = createSocket(SOCKET_OPTS);

    await new Promise<void>((resolve) => socket2.bind(PORT2, resolve));
    const receive = new Promise<[Buffer, UdpRemoteInfo]>((resolve) =>
      socket2.on("message", (msg, rinfo) => resolve([msg, rinfo])),
    );

    await socket1.bind({ port: PORT1 });
    await socket1.connect(PORT2);
    await socket1.send(new Uint8Array([1, 2, 3]));

    const [data, rinfo] = await receive;
    expect(bytesEqual(data, new Uint8Array([1, 2, 3]))).toEqual(true);
    expect(rinfo.address).toEqual("127.0.0.1");
    expect(rinfo.port).toEqual(PORT1);
    expect(rinfo.family).toEqual("IPv4");
    expect(rinfo.size).toEqual(3);

    socket1.dispose();
    socket2.close();
  });
});
