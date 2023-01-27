// In order to ensure a common interface in Web/Electron/Node.js, we use an 'union' interface of 
// - EventTarget
// - EventEmitter
// - MessagePort
// - MessagePortMain
export interface MessagePortLike {
    // Docs: https://electronjs.org/docs/api/message-port-main

    addEventListener<K extends keyof MessagePortEventMap>(type: K, listener: (this: MessagePortLike, ev: MessagePortEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;

    postMessage(message: any, messagePorts?: (Transferable | MessagePortLike)[]): void;

    start(): void;
    close(): void;
}

export interface MessageChannelLike {

    // Docs: https://electronjs.org/docs/api/message-channel-main

    /**
     * A `MessagePortMain` property.
     */
    port1: MessagePortLike;
    /**
     * A `MessagePortMain` property.
     */
    port2: MessagePortLike;
  }

  export function ConvertToMessagePort(messagePortMain: any): MessagePortLike {
    if (messagePortMain.addEventListener == null) {
      messagePortMain.addEventListener = messagePortMain.addListener;
    }
    return messagePortMain as MessagePortLike;
  }
  
  export interface MessageChannelFactory {
    (): MessageChannelLike;
  }