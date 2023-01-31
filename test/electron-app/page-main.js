const { test } = require("./test");

window.addEventListener('load', async () => {
    const electronSocket = require('electron-socket/dist/cjs/renderer/SocketsMain');

    const net = await electronSocket.SocketsMain.Create();
    test(net);
});
