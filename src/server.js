import express from "express";
import WebSocket from "ws";
import http from "http";
import { clearScreenDown } from "readline";

const app = express();

app.set('view engine', "pug");
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public"));
app.get("/", (req,res) => res.render("home"));
app.get("/*", (req,res) => res.render("home"));


const handleListen = () => console.log('Listening on http://localhost:3000');

const server = http.createServer(app);  //express 서버랑 http 합치기
const wss = new WebSocket.Server({server}); //  http서버위에 웹소켓 서버 합치기

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
                const messageString = parsed.payload;
                aSocket.send(messageString)
            });
        } else if(parsed.type === "nickname"){
            socket["nickname"] = message.payload;
        }
    })
})

server.listen(3000,handleListen);

