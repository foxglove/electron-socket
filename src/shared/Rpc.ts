export type Cloneable =
  | void
  | undefined
  | boolean
  | number
  | string
  | Uint8Array
  | Cloneable[]
  | { [key: string]: Cloneable };

export type RpcCall = [
  methodName: string,
  callId: number,
  ...args: Cloneable[]
];

export type RpcResponse = [callId: number, ...args: Cloneable[]];

export type RpcEvent = [eventName: string, ...args: Cloneable[]];

export type RpcHandler = (callId: number, args: Cloneable[]) => void;
