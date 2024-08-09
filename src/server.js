import express from "express";
import http from "http";
import SocketIO from "socket.io";
import { clearScreenDown } from "readline";

const app = express();

app.set('view engine', "pug");
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public"));
app.get("/", (req,res) => res.render("home"));
app.get("/*", (req,res) => res.render("home"));


const handleListen = () => console.log('Listening on http://localhost:3000');

const httpServer = http.createServer(app);  //express 서버랑 http 합치기
const io = SocketIO(httpServer);

io.on("connection", socket => {
    socket.onAny((event) => {
        console.log(`Socket Event: ${event}`);
    })
    socket.on("enter_room", (roomName, done) => {
        socket.join(roomName);
        done()
    })
})


/*
const sockets = [];
wss.on("connection", (socket)=>{
    sockets.push(socket);
    socket["nickname"] = "Anonymous";
    console.log("Connected to Browser!");
    socket.on("close", ()=>{
        console.log("Disconnected from Browser");
    })
    socket.on("message", (message)=>{
        const parsed = JSON.parse(message);
        if(parsed.type === "msg"){
            sockets.forEach((aSocket) => {
                const messageString = (`${socket.nickname}: ${parsed.payload}`);
                aSocket.send(messageString)
            });
        } else if(parsed.type === "nickname"){
            socket["nickname"] = parsed.payload;
        }
    })
})
*/

httpServer.listen(3000,handleListen);

