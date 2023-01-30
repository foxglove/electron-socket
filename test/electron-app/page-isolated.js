const { test } = require("./test");

window.addEventListener('load', async () => {
    const electronSocket = require('electron-socket/dist/cjs/renderer');

    const net = await electronSocket.Sockets.Create();
    test(net);
});
