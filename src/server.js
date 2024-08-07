import express from "express";
import WebSocket from "ws";
import http from "http";
import { clearScreenDown } from "readline";

const app = express();

app.set('view engine', "pug");
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public"));
app.get("/", (req,res) => res.render("home"));
app.get("/*", (req,res) => res.render("/"));


const handleListen = () => console.log('Listening on http://localhost:3000');

const server = http.createServer(app);  //express 서버랑 http 합치기
const wss = new WebSocket.Server({server}); //  http서버위에 웹소켓 서버 합치기

wss.on("connection", (socket)=>{
    console.log("Connected to Browser!");
    socket.on("close", ()=>{
        console.log("Disconnected from Browser");
    })
    socket.on("message", (message)=>{
        console.log(message.toString('utf8'))
    })
    socket.send("hello");
})

server.listen(3000,handleListen);

