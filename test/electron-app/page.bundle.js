(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpServerRenderer = void 0;
const eventemitter3_1 = __importDefault(require("eventemitter3"));
class HttpServerRenderer extends eventemitter3_1.default {
    constructor(messagePort, requestHandler) {
        super();
        this._callbacks = new Map();
        this._nextCallId = 0;
        this._eventMap = new Map([
            ["close", () => this.emit("close")],
            [
                "request",
                async (args) => {
                    const requestId = args[0];
                    const req = args[1];
                    let res;
                    try {
                        res = await this.handler(req);
                    }
                    catch (err) {
                        res = { statusCode: 500, statusMessage: String(err) };
                    }
                    void this._apiCall("response", requestId, res);
                },
            ],
            ["error", (args) => this.emit("error", new Error(args[0]))],
        ]);
        this._messagePort = messagePort;
        this.handler = requestHandler ?? (async () => ({ statusCode: 404 }));
        messagePort.onmessage = (ev) => {
            const args = ev.data.slice(1);
            if (typeof ev.data[0] === "number") {
                // RpcResponse
                const callId = ev.data[0];
                const callback = this._callbacks.get(callId);
                if (callback != undefined) {
                    this._callbacks.delete(callId);
                    callback(args);
                }
            }
            else {
                // RpcEvent
                const eventName = ev.data[0];
                const handler = this._eventMap.get(eventName);
                handler?.(args, ev.ports);
            }
        };
        messagePort.start();
    }
    url() {
        return this._url;
    }
    port() {
        return this._port;
    }
    async address() {
        const res = await this._apiCall("address");
        return res[0];
    }
    async listen(port, hostname, backlog) {
        const res = await this._apiCall("listen", port, hostname, backlog);
        const err = res[0];
        if (err != undefined) {
            throw new Error(err);
        }
        // Store the URL and port we are listening at
        const addr = await this.address();
        if (addr == undefined || typeof addr === "string") {
            this._url = addr;
            this._port = undefined;
        }
        else {
            this._url = `http://${hostname ?? addr.address}:${addr.port}/`;
            this._port = addr.port;
        }
    }
    async close() {
        await this._apiCall("close");
    }
    async dispose() {
        await this._apiCall("dispose");
        this._messagePort.onmessage = null;
        this._messagePort.close();
        this._callbacks.clear();
    }
    async _apiCall(methodName, ...args) {
        return await new Promise((resolve) => {
            const callId = this._nextCallId++;
            this._callbacks.set(callId, (result) => {
                this._callbacks.delete(callId);
                resolve(result);
            });
            const msg = [methodName, callId, ...args];
            this._messagePort.postMessage(msg);
        });
    }
}
exports.HttpServerRenderer = HttpServerRenderer;

},{"eventemitter3":7}],2:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Sockets = void 0;
const HttpServerRenderer_js_1 = require("./HttpServerRenderer.js");
const TcpServerRenderer_js_1 = require("./TcpServerRenderer.js");
const TcpSocketRenderer_js_1 = require("./TcpSocketRenderer.js");
const UdpSocketRenderer_js_1 = require("./UdpSocketRenderer.js");
class Sockets {
    constructor(messagePort) {
        // Completion callbacks for any in-flight RPC calls
        this._callbacks = new Map();
        // Asynchronous RPC calls are tracked using a callId integer
        this._nextCallId = 0;
        this._messagePort = messagePort;
        messagePort.onmessage = (ev) => {
            const callId = ev.data[0];
            const args = ev.data.slice(1);
            const callback = this._callbacks.get(callId);
            if (callback != undefined) {
                this._callbacks.delete(callId);
                callback(args, ev.ports);
            }
        };
    }
    async createHttpServer(requestHandler) {
        return await new Promise((resolve, reject) => {
            const callId = this._nextCallId++;
            this._callbacks.set(callId, (_, ports) => {
                const port = ports?.[0];
                if (port == undefined) {
                    return reject(new Error("no port returned"));
                }
                resolve(new HttpServerRenderer_js_1.HttpServerRenderer(port, requestHandler));
            });
            const msg = ["createHttpServer", callId];
            this._messagePort.postMessage(msg);
        });
    }
    async createSocket(host, port) {
        return await new Promise((resolve, reject) => {
            const callId = this._nextCallId++;
            this._callbacks.set(callId, (args, ports) => {
                const msgPort = ports?.[0];
                if (msgPort == undefined) {
                    const err = args[0];
                    return reject(new Error(err ?? "no port returned"));
                }
                resolve(new TcpSocketRenderer_js_1.TcpSocketRenderer(msgPort));
            });
            const msg = ["createSocket", callId, host, port];
            this._messagePort.postMessage(msg);
        });
    }
    async createServer() {
        return await new Promise((resolve, reject) => {
            const callId = this._nextCallId++;
            this._callbacks.set(callId, (args, ports) => {
                const port = ports?.[0];
                if (port == undefined) {
                    const err = args[0];
                    return reject(new Error(err ?? "no port returned"));
                }
                resolve(new TcpServerRenderer_js_1.TcpServerRenderer(port));
            });
            const msg = ["createServer", callId];
            this._messagePort.postMessage(msg);
        });
    }
    async createUdpSocket() {
        return await new Promise((resolve, reject) => {
            const callId = this._nextCallId++;
            this._callbacks.set(callId, (args, ports) => {
                const msgPort = ports?.[0];
                if (msgPort == undefined) {
                    const err = args[0];
                    return reject(new Error(err ?? "no port returned"));
                }
                resolve(new UdpSocketRenderer_js_1.UdpSocketRenderer(msgPort));
            });
            const msg = ["createUdpSocket", callId];
            this._messagePort.postMessage(msg);
        });
    }
    // Initialize electron-socket on the renderer side. This method should be called
    // before the window is loaded
    static async Create(channel = "__electron_socket") {
        const entry = Sockets.registeredSockets.get(channel);
        if (entry != undefined) {
            const promise = entry;
            if (typeof promise.then === "function") {
                return await promise;
            }
            return await entry;
        }
        const promise = new Promise((resolve) => {
            const messageListener = (windowEv) => {
                if (windowEv.target !== window || windowEv.data !== channel) {
                    return;
                }
                const messagePort = windowEv.ports[0];
                if (messagePort == undefined) {
                    return;
                }
                const sockets = new Sockets(messagePort);
                Sockets.registeredSockets.set(channel, sockets);
                window.removeEventListener("message", messageListener);
                resolve(sockets);
            };
            window.addEventListener("message", messageListener);
        });
        Sockets.registeredSockets.set(channel, promise);
        return await promise;
    }
}
exports.Sockets = Sockets;
// A map of created `Sockets` instances, or a promise if creation is in progress
Sockets.registeredSockets = new Map();

},{"./HttpServerRenderer.js":1,"./TcpServerRenderer.js":4,"./TcpSocketRenderer.js":5,"./UdpSocketRenderer.js":6}],3:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketsMain = void 0;
const Sockets_1 = require("./Sockets");
class SocketsMain {
    // Initialize electron-socket on the Main side.
    static async Create(channel = "__electron_socket") {
        const entry = Sockets_1.Sockets.registeredSockets.get(channel);
        if (entry != undefined) {
            const promise = entry;
            if (typeof promise.then === "function") {
                return await promise;
            }
            return await entry;
        }
        const promise = new Promise((resolve) => {
            const ipcRenderer = window.socketIpcRenderer;
            ipcRenderer.send('__electron_socket_main', channel);
            ipcRenderer.once(channel, (ev) => {
                const messagePort = ev.ports[0];
                if (messagePort == undefined) {
                    return;
                }
                const sockets = new Sockets_1.Sockets(messagePort);
                Sockets_1.Sockets.registeredSockets.set(channel, sockets);
                resolve(sockets);
            });
        });
        Sockets_1.Sockets.registeredSockets.set(channel, promise);
        return await promise;
    }
}
exports.SocketsMain = SocketsMain;

},{"./Sockets":2}],4:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TcpServerRenderer = void 0;
const eventemitter3_1 = __importDefault(require("eventemitter3"));
const TcpSocketRenderer_js_1 = require("./TcpSocketRenderer.js");
class TcpServerRenderer extends eventemitter3_1.default {
    constructor(messagePort) {
        super();
        this._callbacks = new Map();
        this._nextCallId = 0;
        this._eventMap = new Map([
            ["close", () => this.emit("close")],
            [
                "connection",
                (_, ports) => {
                    const port = ports?.[0];
                    if (port != undefined) {
                        const socket = new TcpSocketRenderer_js_1.TcpSocketRenderer(port);
                        this.emit("connection", socket);
                    }
                },
            ],
            ["error", (args) => this.emit("error", new Error(args[0]))],
        ]);
        this._messagePort = messagePort;
        messagePort.onmessage = (ev) => {
            const args = ev.data.slice(1);
            if (typeof ev.data[0] === "number") {
                // RpcResponse
                const callId = ev.data[0];
                const callback = this._callbacks.get(callId);
                if (callback != undefined) {
                    this._callbacks.delete(callId);
                    callback(args);
                }
            }
            else {
                // RpcEvent
                const eventName = ev.data[0];
                const handler = this._eventMap.get(eventName);
                handler?.(args, ev.ports);
            }
        };
        messagePort.start();
    }
    async address() {
        const res = await this._apiCall("address");
        return res[0];
    }
    async listen(port, hostname, backlog) {
        const res = await this._apiCall("listen", port, hostname, backlog);
        if (res[0] != undefined) {
            throw new Error(res[0]);
        }
    }
    async close() {
        await this._apiCall("close");
    }
    async dispose() {
        await this._apiCall("dispose");
        this._messagePort.onmessage = null;
        this._messagePort.close();
        this._callbacks.clear();
    }
    async _apiCall(methodName, ...args) {
        return await new Promise((resolve) => {
            const callId = this._nextCallId++;
            this._callbacks.set(callId, (result) => {
                this._callbacks.delete(callId);
                resolve(result);
            });
            const msg = [methodName, callId, ...args];
            this._messagePort.postMessage(msg);
        });
    }
}
exports.TcpServerRenderer = TcpServerRenderer;

},{"./TcpSocketRenderer.js":5,"eventemitter3":7}],5:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TcpSocketRenderer = void 0;
const eventemitter3_1 = __importDefault(require("eventemitter3"));
class TcpSocketRenderer extends eventemitter3_1.default {
    constructor(messagePort) {
        super();
        this._callbacks = new Map();
        this._nextCallId = 0;
        this._eventMap = new Map([
            ["connect", () => this.emit("connect")],
            ["close", () => this.emit("close")],
            ["end", () => this.emit("end")],
            ["timeout", () => this.emit("timeout")],
            ["error", (args) => this.emit("error", new Error(args[0]))],
            ["data", (args) => this.emit("data", args[0])],
        ]);
        this._messagePort = messagePort;
        messagePort.onmessage = (ev) => {
            const args = ev.data.slice(1);
            if (typeof ev.data[0] === "number") {
                // RpcResponse
                const callId = ev.data[0];
                const callback = this._callbacks.get(callId);
                if (callback != undefined) {
                    this._callbacks.delete(callId);
                    callback(args);
                }
            }
            else {
                // RpcEvent
                const eventName = ev.data[0];
                const handler = this._eventMap.get(eventName);
                handler?.(args, ev.ports);
            }
        };
        messagePort.start();
    }
    async remoteAddress() {
        const res = await this._apiCall("remoteAddress");
        return res[0];
    }
    async localAddress() {
        const res = await this._apiCall("localAddress");
        return res[0];
    }
    async fd() {
        const res = await this._apiCall("fd");
        return res[0];
    }
    async setKeepAlive(enable, initialDelay) {
        await this._apiCall("setKeepAlive", enable, initialDelay);
    }
    async setTimeout(timeout) {
        await this._apiCall("setTimeout", timeout);
    }
    async setNoDelay(noDelay) {
        await this._apiCall("setNoDelay", noDelay);
    }
    async connected() {
        const res = await this._apiCall("connected");
        return res[0];
    }
    async connect(options) {
        const res = await this._apiCall("connect", options);
        if (res[0] != undefined) {
            throw new Error(res[0]);
        }
    }
    async close() {
        await this._apiCall("close");
    }
    async dispose() {
        await this._apiCall("dispose");
        this._messagePort.onmessage = null;
        this._messagePort.close();
        this._callbacks.clear();
    }
    async write(data, transfer = false) {
        return await new Promise((resolve) => {
            const callId = this._nextCallId++;
            this._callbacks.set(callId, () => {
                this._callbacks.delete(callId);
                resolve();
            });
            const msg = ["write", callId, data];
            if (transfer) {
                this._messagePort.postMessage(msg, [data.buffer]);
            }
            else {
                this._messagePort.postMessage(msg);
            }
        });
    }
    async _apiCall(methodName, ...args) {
        return await new Promise((resolve) => {
            const callId = this._nextCallId++;
            this._callbacks.set(callId, (result) => {
                this._callbacks.delete(callId);
                resolve(result);
            });
            const msg = [methodName, callId, ...args];
            this._messagePort.postMessage(msg);
        });
    }
}
exports.TcpSocketRenderer = TcpSocketRenderer;

},{"eventemitter3":7}],6:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UdpSocketRenderer = void 0;
const eventemitter3_1 = __importDefault(require("eventemitter3"));
class UdpSocketRenderer extends eventemitter3_1.default {
    constructor(messagePort) {
        super();
        this._callbacks = new Map();
        this._nextCallId = 0;
        this._eventMap = new Map([
            ["connect", () => this.emit("connect")],
            ["close", () => this.emit("close")],
            ["listening", () => this.emit("listening")],
            ["error", (args) => this.emit("error", new Error(args[0]))],
            ["message", (args) => this.emit("message", args[0], args[1])],
        ]);
        this._messagePort = messagePort;
        messagePort.onmessage = (ev) => {
            const args = ev.data.slice(1);
            if (typeof ev.data[0] === "number") {
                // RpcResponse
                const callId = ev.data[0];
                const callback = this._callbacks.get(callId);
                if (callback != undefined) {
                    this._callbacks.delete(callId);
                    callback(args);
                }
            }
            else {
                // RpcEvent
                const eventName = ev.data[0];
                const handler = this._eventMap.get(eventName);
                handler?.(args, ev.ports);
            }
        };
        messagePort.start();
    }
    async remoteAddress() {
        const res = await this._apiCall("remoteAddress");
        return res[0];
    }
    async localAddress() {
        const res = await this._apiCall("localAddress");
        return res[0];
    }
    async fd() {
        const res = await this._apiCall("fd");
        return res[0];
    }
    async addMembership(multicastAddress, multicastInterface) {
        await this._apiCall("addMembership", multicastAddress, multicastInterface);
    }
    async addSourceSpecificMembership(sourceAddress, groupAddress, multicastInterface) {
        await this._apiCall("addSourceSpecificMembership", sourceAddress, groupAddress, multicastInterface);
    }
    async bind(options) {
        const res = await this._apiCall("bind", options);
        if (res[0] != undefined) {
            throw new Error(res[0]);
        }
    }
    async connect(port, address) {
        const res = await this._apiCall("connect", port, address);
        if (res[0] != undefined) {
            throw new Error(res[0]);
        }
    }
    async close() {
        await this._apiCall("close");
    }
    async disconnect() {
        await this._apiCall("disconnect");
    }
    async dispose() {
        await this._apiCall("dispose");
        this._messagePort.onmessage = null;
        this._messagePort.close();
        this._callbacks.clear();
    }
    async dropMembership(multicastAddress, multicastInterface) {
        await this._apiCall("dropMembership", multicastAddress, multicastInterface);
    }
    async dropSourceSpecificMembership(sourceAddress, groupAddress, multicastInterface) {
        await this._apiCall("dropSourceSpecificMembership", sourceAddress, groupAddress, multicastInterface);
    }
    async send(data, offset, length, port, address, transfer = false) {
        return await new Promise((resolve) => {
            const callId = this._nextCallId++;
            this._callbacks.set(callId, () => {
                this._callbacks.delete(callId);
                resolve();
            });
            const msg = ["send", callId, data, offset, length, port, address];
            if (transfer) {
                this._messagePort.postMessage(msg, [data.buffer]);
            }
            else {
                this._messagePort.postMessage(msg);
            }
        });
    }
    async setBroadcast(flag) {
        await this._apiCall("setBroadcast", flag);
    }
    async setMulticastInterface(multicastInterface) {
        await this._apiCall("setMulticastInterface", multicastInterface);
    }
    async setMulticastLoopback(flag) {
        await this._apiCall("setMulticastLoopback", flag);
    }
    async setMulticastTTL(ttl) {
        await this._apiCall("setMulticastTTL", ttl);
    }
    async setRecvBufferSize(size) {
        await this._apiCall("setRecvBufferSize", size);
    }
    async setSendBufferSize(size) {
        await this._apiCall("setSendBufferSize", size);
    }
    async setTTL(ttl) {
        await this._apiCall("setTTL", ttl);
    }
    async _apiCall(methodName, ...args) {
        return await new Promise((resolve) => {
            const callId = this._nextCallId++;
            this._callbacks.set(callId, (result) => {
                this._callbacks.delete(callId);
                resolve(result);
            });
            const msg = [methodName, callId, ...args];
            this._messagePort.postMessage(msg);
        });
    }
}
exports.UdpSocketRenderer = UdpSocketRenderer;

},{"eventemitter3":7}],7:[function(require,module,exports){
'use strict';

var has = Object.prototype.hasOwnProperty
  , prefix = '~';

/**
 * Constructor to create a storage for our `EE` objects.
 * An `Events` instance is a plain object whose properties are event names.
 *
 * @constructor
 * @private
 */
function Events() {}

//
// We try to not inherit from `Object.prototype`. In some engines creating an
// instance in this way is faster than calling `Object.create(null)` directly.
// If `Object.create(null)` is not supported we prefix the event names with a
// character to make sure that the built-in object properties are not
// overridden or used as an attack vector.
//
if (Object.create) {
  Events.prototype = Object.create(null);

  //
  // This hack is needed because the `__proto__` property is still inherited in
  // some old browsers like Android 4, iPhone 5.1, Opera 11 and Safari 5.
  //
  if (!new Events().__proto__) prefix = false;
}

/**
 * Representation of a single event listener.
 *
 * @param {Function} fn The listener function.
 * @param {*} context The context to invoke the listener with.
 * @param {Boolean} [once=false] Specify if the listener is a one-time listener.
 * @constructor
 * @private
 */
function EE(fn, context, once) {
  this.fn = fn;
  this.context = context;
  this.once = once || false;
}

/**
 * Add a listener for a given event.
 *
 * @param {EventEmitter} emitter Reference to the `EventEmitter` instance.
 * @param {(String|Symbol)} event The event name.
 * @param {Function} fn The listener function.
 * @param {*} context The context to invoke the listener with.
 * @param {Boolean} once Specify if the listener is a one-time listener.
 * @returns {EventEmitter}
 * @private
 */
function addListener(emitter, event, fn, context, once) {
  if (typeof fn !== 'function') {
    throw new TypeError('The listener must be a function');
  }

  var listener = new EE(fn, context || emitter, once)
    , evt = prefix ? prefix + event : event;

  if (!emitter._events[evt]) emitter._events[evt] = listener, emitter._eventsCount++;
  else if (!emitter._events[evt].fn) emitter._events[evt].push(listener);
  else emitter._events[evt] = [emitter._events[evt], listener];

  return emitter;
}

/**
 * Clear event by name.
 *
 * @param {EventEmitter} emitter Reference to the `EventEmitter` instance.
 * @param {(String|Symbol)} evt The Event name.
 * @private
 */
function clearEvent(emitter, evt) {
  if (--emitter._eventsCount === 0) emitter._events = new Events();
  else delete emitter._events[evt];
}

/**
 * Minimal `EventEmitter` interface that is molded against the Node.js
 * `EventEmitter` interface.
 *
 * @constructor
 * @public
 */
function EventEmitter() {
  this._events = new Events();
  this._eventsCount = 0;
}

/**
 * Return an array listing the events for which the emitter has registered
 * listeners.
 *
 * @returns {Array}
 * @public
 */
EventEmitter.prototype.eventNames = function eventNames() {
  var names = []
    , events
    , name;

  if (this._eventsCount === 0) return names;

  for (name in (events = this._events)) {
    if (has.call(events, name)) names.push(prefix ? name.slice(1) : name);
  }

  if (Object.getOwnPropertySymbols) {
    return names.concat(Object.getOwnPropertySymbols(events));
  }

  return names;
};

/**
 * Return the listeners registered for a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @returns {Array} The registered listeners.
 * @public
 */
EventEmitter.prototype.listeners = function listeners(event) {
  var evt = prefix ? prefix + event : event
    , handlers = this._events[evt];

  if (!handlers) return [];
  if (handlers.fn) return [handlers.fn];

  for (var i = 0, l = handlers.length, ee = new Array(l); i < l; i++) {
    ee[i] = handlers[i].fn;
  }

  return ee;
};

/**
 * Return the number of listeners listening to a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @returns {Number} The number of listeners.
 * @public
 */
EventEmitter.prototype.listenerCount = function listenerCount(event) {
  var evt = prefix ? prefix + event : event
    , listeners = this._events[evt];

  if (!listeners) return 0;
  if (listeners.fn) return 1;
  return listeners.length;
};

/**
 * Calls each of the listeners registered for a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @returns {Boolean} `true` if the event had listeners, else `false`.
 * @public
 */
EventEmitter.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
  var evt = prefix ? prefix + event : event;

  if (!this._events[evt]) return false;

  var listeners = this._events[evt]
    , len = arguments.length
    , args
    , i;

  if (listeners.fn) {
    if (listeners.once) this.removeListener(event, listeners.fn, undefined, true);

    switch (len) {
      case 1: return listeners.fn.call(listeners.context), true;
      case 2: return listeners.fn.call(listeners.context, a1), true;
      case 3: return listeners.fn.call(listeners.context, a1, a2), true;
      case 4: return listeners.fn.call(listeners.context, a1, a2, a3), true;
      case 5: return listeners.fn.call(listeners.context, a1, a2, a3, a4), true;
      case 6: return listeners.fn.call(listeners.context, a1, a2, a3, a4, a5), true;
    }

    for (i = 1, args = new Array(len -1); i < len; i++) {
      args[i - 1] = arguments[i];
    }

    listeners.fn.apply(listeners.context, args);
  } else {
    var length = listeners.length
      , j;

    for (i = 0; i < length; i++) {
      if (listeners[i].once) this.removeListener(event, listeners[i].fn, undefined, true);

      switch (len) {
        case 1: listeners[i].fn.call(listeners[i].context); break;
        case 2: listeners[i].fn.call(listeners[i].context, a1); break;
        case 3: listeners[i].fn.call(listeners[i].context, a1, a2); break;
        case 4: listeners[i].fn.call(listeners[i].context, a1, a2, a3); break;
        default:
          if (!args) for (j = 1, args = new Array(len -1); j < len; j++) {
            args[j - 1] = arguments[j];
          }

          listeners[i].fn.apply(listeners[i].context, args);
      }
    }
  }

  return true;
};

/**
 * Add a listener for a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @param {Function} fn The listener function.
 * @param {*} [context=this] The context to invoke the listener with.
 * @returns {EventEmitter} `this`.
 * @public
 */
EventEmitter.prototype.on = function on(event, fn, context) {
  return addListener(this, event, fn, context, false);
};

/**
 * Add a one-time listener for a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @param {Function} fn The listener function.
 * @param {*} [context=this] The context to invoke the listener with.
 * @returns {EventEmitter} `this`.
 * @public
 */
EventEmitter.prototype.once = function once(event, fn, context) {
  return addListener(this, event, fn, context, true);
};

/**
 * Remove the listeners of a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @param {Function} fn Only remove the listeners that match this function.
 * @param {*} context Only remove the listeners that have this context.
 * @param {Boolean} once Only remove one-time listeners.
 * @returns {EventEmitter} `this`.
 * @public
 */
EventEmitter.prototype.removeListener = function removeListener(event, fn, context, once) {
  var evt = prefix ? prefix + event : event;

  if (!this._events[evt]) return this;
  if (!fn) {
    clearEvent(this, evt);
    return this;
  }

  var listeners = this._events[evt];

  if (listeners.fn) {
    if (
      listeners.fn === fn &&
      (!once || listeners.once) &&
      (!context || listeners.context === context)
    ) {
      clearEvent(this, evt);
    }
  } else {
    for (var i = 0, events = [], length = listeners.length; i < length; i++) {
      if (
        listeners[i].fn !== fn ||
        (once && !listeners[i].once) ||
        (context && listeners[i].context !== context)
      ) {
        events.push(listeners[i]);
      }
    }

    //
    // Reset the array, or remove it completely if we have no more listeners.
    //
    if (events.length) this._events[evt] = events.length === 1 ? events[0] : events;
    else clearEvent(this, evt);
  }

  return this;
};

/**
 * Remove all listeners, or those of the specified event.
 *
 * @param {(String|Symbol)} [event] The event name.
 * @returns {EventEmitter} `this`.
 * @public
 */
EventEmitter.prototype.removeAllListeners = function removeAllListeners(event) {
  var evt;

  if (event) {
    evt = prefix ? prefix + event : event;
    if (this._events[evt]) clearEvent(this, evt);
  } else {
    this._events = new Events();
    this._eventsCount = 0;
  }

  return this;
};

//
// Alias methods names because people roll like that.
//
EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
EventEmitter.prototype.addListener = EventEmitter.prototype.on;

//
// Expose the prefix.
//
EventEmitter.prefixed = prefix;

//
// Allow `EventEmitter` to be imported as module namespace.
//
EventEmitter.EventEmitter = EventEmitter;

//
// Expose the module.
//
if ('undefined' !== typeof module) {
  module.exports = EventEmitter;
}

},{}],8:[function(require,module,exports){

window.addEventListener('load', async () => {
    const electronSocket = require('../../dist/cjs/renderer/SocketsMain');

    const net = await electronSocket.SocketsMain.Create();
    
    const server = await net.createServer();
    server.on("connection", (client) => {
        client.write(new Uint8Array([42]));
    });
    server.listen(9900);
    
    const socket = await net.createSocket();
    socket.on("data", (data) => console.log(`Server sent ${data}`));
    socket.connect({ port: 9900, host: "localhost" });
});

},{"../../dist/cjs/renderer/SocketsMain":3}]},{},[8]);
