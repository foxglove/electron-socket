
window.addEventListener('load', async () => {
    const electronSocket = require('electron-socket/dist/cjs/renderer');

    const net = await electronSocket.Sockets.Create();
    
    const server = await net.createServer();
    server.on("connection", (client) => {
        client.write(new Uint8Array([44]));
    });
    server.listen(9990);
    
    const socket = await net.createSocket();
    socket.on("data", (data) => console.log(`Server sent ${data}`));
    socket.connect({ port: 9990, host: "localhost" });
});
