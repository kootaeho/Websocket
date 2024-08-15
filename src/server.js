import express from "express";
import http from "http";
import {Server} from "socket.io";
import {instrument} from "@socket.io/admin-ui";
import { clearScreenDown } from "readline";

const app = express();

app.set('view engine', "pug");
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public"));
app.get("/", (req,res) => res.render("home"));
app.get("/*", (req,res) => res.render("home"));


const handleListen = () => console.log('Listening on http://localhost:3000');

const httpServer = http.createServer(app);  //express 서버랑 http 합치기
const io = new Server(httpServer, {
    cors : {
        origin: ["https://admin.socket.io"],
        credentials: true
    }
});

instrument(io, {
    auth: false,
    mode: "development",
});


function publicRooms(){
   const {sockets: {adapter: {sids,rooms}}} = io;  // == const sids = io.sockets.adapter.sids; const rooms = io.sockets.adapter.rooms; 
   // == const {sockets: {adapter: {sids : mysids ,rooms : myrooms }}} = io; 이렇게 하면 다른이름의 변수에 저장가능.
   const userRooms = [];
   rooms.forEach((_, key) => {
        if(sids.get(key) === undefined){
            userRooms.push(key);
        }
   })
   return userRooms;
}

function countRoom(roomName){
    return io.sockets.adapter.rooms.get(roomName)?.size;
}



io.on("connection", (socket) => {
    io.sockets.emit("room_change", publicRooms());
    socket["nickname"] = "Annonymous";
    socket.onAny((event) => {
        console.log(`Socket Event: ${event}`);
    })
    socket.on("enter_room", (roomName,done) => {
        //const roomName = socket.id
        const publicRoomArr = publicRooms();
        const randomElement = publicRoomArr[Math.floor(Math.random() * publicRoomArr.length)];
        if(publicRoomArr.length === 0){
            console.log("Creating room!");
            socket.join(roomName);
            done();
            io.to(roomName).emit("join", countRoom(roomName));
            socket.to(roomName).emit("welcome", socket.nickname, countRoom(roomName));
            io.sockets.emit("room_change", publicRooms());
        }
        else{
            console.log("Existed room enter!");
            socket.join(randomElement);
            done();
            io.to(randomElement).emit("join", countRoom(randomElement));
            socket.to(randomElement).emit("welcome", socket.nickname, countRoom(randomElement));
            io.sockets.emit("room_change", publicRooms());
        }
    
    })
    socket.on("disconnecting", ()=> {
        socket.rooms.forEach((room) => socket.to(room).emit("bye",socket.nickname, countRoom(room) - 1));
    });
    socket.on("disconnect", () => {
        io.sockets.emit("room_change", publicRooms());
    })
    socket.on("new_message", (msg, room, done)=>{
        socket.to(room).emit("new_message", `${socket.nickname} : ${msg}`)
        done();
    })
    socket.on("nickname", (nickname)=> {
        socket["nickname"] = nickname
    });
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

