
window.addEventListener('load', async () => {
    const electronSocket = require('electron-socket/dist/cjs/renderer/SocketsMain');

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
