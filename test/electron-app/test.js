async function test(net) {
    const server = await net.createServer();
    server.on("connection", (client) => {
        client.write(new Uint8Array([42]));
    });
    server.listen(9900);
    
    const socket = await net.createSocket();
    socket.on("data", (data) => {
        console.log(`Server sent ${data}`);
        
        document.open();
        document.write(`<h1>Socket received</h1>`);
        document.write(`<br>`);
        document.write(`${data}`);
        document.write(`<br>`);
        document.close();
    });
    socket.connect({ port: 9900, host: "localhost" });
}

exports.test = test;