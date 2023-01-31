async function test(net) {
    const server = await net.createServer();
    server.on("connection", (client) => {
        client.write(new Uint8Array([42]));
        client.write("ceci est une string");
        client.write(Buffer.from("ceci est un buffer"));
    });
    server.listen(9900);
    
    let datas = [];
    const socket = await net.createSocket();
    socket.on("data", (data) => {
        console.log(`Server sent ${data}`);

        datas.push(data.toString());
        
        document.open();
        document.write(`<h1>Socket received</h1>`);
        document.write(`<br>`);
        document.write(datas.join("<br>"));
        document.close();
    });
    socket.connect({ port: 9900, host: "localhost" });
}

exports.test = test;