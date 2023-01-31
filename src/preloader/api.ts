import { SocketOptions as UdpSocketOptions, createSocket as createNodejsUdpSocket } from "dgram";
import { Socket } from "net";

import { HttpServerElectron } from "./HttpServerElectron.js";
import { TcpServerElectron } from "./TcpServerElectron.js";
import { TcpSocketElectron } from "./TcpSocketElectron.js";
import { UdpSocketElectron } from "./UdpSocketElectron.js";
import { dnsLookup } from "./dns.js";
import { nextId, registerEntity } from "./registry.js";
import { ConvertToMessagePort, MessageChannelFactory, MessagePortLike } from "../shared/MessagePort.js";

export function createHttpServer(messageChannelFactory: MessageChannelFactory): MessagePortLike {
  const channel = messageChannelFactory();
  const id = nextId();
  const server = new HttpServerElectron(messageChannelFactory, id, ConvertToMessagePort(channel.port2));
  registerEntity(id, server);
  return channel.port1;
}

export function createSocket(messageChannelFactory: MessageChannelFactory): MessagePortLike | undefined {
  const channel = messageChannelFactory();
  const id = nextId();
  const socket = new TcpSocketElectron(messageChannelFactory, id, ConvertToMessagePort(channel.port2), new Socket());
  registerEntity(id, socket);
  return channel.port1;
}

export function createServer(messageChannelFactory: MessageChannelFactory): MessagePortLike | undefined {
  const channel = messageChannelFactory();
  const id = nextId();
  const server = new TcpServerElectron(messageChannelFactory, id, ConvertToMessagePort(channel.port2));
  registerEntity(id, server);
  return channel.port1;
}

export function createUdpSocket(messageChannelFactory: MessageChannelFactory): MessagePortLike | undefined {
  const SOCKET_OPTS: UdpSocketOptions = { type: "udp4", reuseAddr: true, lookup: dnsLookup };

  const channel = messageChannelFactory();
  const id = nextId();
  const socket = new UdpSocketElectron(messageChannelFactory, id, ConvertToMessagePort(channel.port2), createNodejsUdpSocket(SOCKET_OPTS));
  registerEntity(id, socket);
  return channel.port1;
}
