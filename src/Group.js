import express from "express";
import http from "http";
import {Server} from "socket.io";
import {instrument} from "@socket.io/admin-ui";
import { clearScreenDown } from "readline";
import { count } from "console";

const app = express();
const now = new Date();
const mysql = require("mysql2");
const dbconfig = require('./config/dbconfig.json');
console.log(now.toLocaleTimeString()); 
app.set('view engine', "pug");
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public"));
app.get("/", (req,res) => res.render("home"));
app.get("/*", (req,res) => res.render("home"));

console.log("Group.js 실행됨!");
const handleListen = () => console.log('Listening on http://localhost:3001');

const GrouphttpServer = http.createServer(app);  //express 서버랑 http 합치기
const io = new Server(GrouphttpServer, {
    cors : {
        origin: ["https://admin.socket.io"],
        credentials: true
    }
});

instrument(io, {
    auth: false,
    mode: "development",
});
const GroupChat = io.of("/group");
const oneOnoneChat = io.of("/oneonone");

GrouphttpServer.listen(3001,handleListen);

function publicGroupRooms(namespace){
    if (!namespace.adapter || !namespace.adapter.rooms) {
        console.log("네임스페이스 오류!");
        return [];
    }
   const {adapter: {sids,rooms}} = namespace;  // const sids = io.sockets.adapter.sids; const rooms = io.sockets.adapter.rooms; 
   // == const {sockets: {adapter: {sids : mysids ,rooms : myrooms }}} = io; 이렇게 하면 다른이름의 변수에 저장가능.
   const userGroupRooms = [];
   for (const [key, value] of rooms) {
    // 방이 클라이언트 개별 ID(sids)에 포함되지 않은 경우 공용 방으로 간주
        if (!sids.has(key)) {
            userGroupRooms.push(key);
        }
    }
   return userGroupRooms;
}

function countRoom(namespace,roomName){
    //console.log(namespace.adapter.rooms.get(roomName)?.size);
    return namespace.adapter.rooms.get(roomName)?.size ;
}


GroupChat.on("connection", (socket) => {
    socket["nickname"] = "Anonymous";

    socket.on("enter_room", (roomName, MaxCap , done) => {
        const GroupRoomArr = publicGroupRooms(GroupChat);
        let roomToJoin;
        let RoomCap = MaxCap;
        if (GroupRoomArr.length === 0) {
            roomToJoin = roomName || `room_${Math.floor(Math.random() * 1000)}`;
            socket.join(roomToJoin);
        } else {
            roomToJoin = GroupRoomArr[Math.floor(Math.random() * GroupRoomArr.length)];
            let roomNum = countRoom(GroupChat,roomToJoin)
            if(roomNum >= RoomCap ){
                roomToJoin = roomName || `room_${Math.floor(Math.random() * 1000)}`;
                socket.join(roomToJoin);
            }
            else{
                socket.join(roomToJoin);
            }
        }
        done(roomToJoin);
        GroupChat.to(roomToJoin).emit("join", countRoom(GroupChat,roomToJoin));
        GroupChat.to(roomToJoin).emit("welcome", socket.nickname, countRoom(GroupChat,roomToJoin));
        GroupChat.emit("room_change", publicGroupRooms(GroupChat));
    });

    socket.on("disconnecting", () => {
        socket.rooms.forEach((room) => socket.to(room).emit("bye", socket.nickname, countRoom(GroupChat,room) - 1));
    });

    socket.on("disconnect", () => {
        GroupChat.emit("room_change", publicGroupRooms(GroupChat));
    });

    socket.on("new_message", (msg, room, done) => {
        socket.to(room).emit("new_message", `${socket.nickname}: ${msg}`);
        done();
    });

    socket.on("nickname", (nickname) => {
        socket["nickname"] = nickname;
    });
});


oneOnoneChat.on("connection", (socket) => {
    //io.sockets.emit("room_change", publicRooms());
    socket["nickname"] = "Anonymous";

    socket.on("enter_room", (roomName, MaxCap , done) => {
        const RoomArr = publicGroupRooms(oneOnoneChat);
        let roomToJoin;
        let RoomCap = MaxCap;
        if (RoomArr.length === 0) {
            roomToJoin = roomName || `room_${Math.floor(Math.random() * 1000)}`;
            socket.join(roomToJoin);
        } else {
            roomToJoin = RoomArr[Math.floor(Math.random() * RoomArr.length)];
            let roomNum = countRoom(oneOnoneChat,roomToJoin)
            if(roomNum >= RoomCap ){
                roomToJoin = roomName || `room_${Math.floor(Math.random() * 1000)}`;
                socket.join(roomToJoin);
            }
            else{
                socket.join(roomToJoin);
            }
        }
        done(roomToJoin);
        oneOnoneChat.to(roomToJoin).emit("join", countRoom(oneOnoneChat,roomToJoin));
        oneOnoneChat.to(roomToJoin).emit("welcome", socket.nickname, countRoom(oneOnoneChat,roomToJoin));
        oneOnoneChat.emit("room_change", publicGroupRooms(oneOnoneChat));
    });

    socket.on("disconnecting", () => {
        socket.rooms.forEach((room) => socket.to(room).emit("bye", socket.nickname, countRoom(oneOnoneChat,room) - 1));
    });

    socket.on("disconnect", () => {
        oneOnoneChat.emit("room_change", publicGroupRooms(oneOnoneChat));
    });

    socket.on("new_message", (msg, room, done) => {
        socket.to(room).emit("new_message", `${socket.nickname}: ${msg}`);
        done();
    });

    socket.on("nickname", (nickname) => {
        socket["nickname"] = nickname;
    });
});
