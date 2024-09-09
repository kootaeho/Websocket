import express from "express";
import http from "http";
import {Server} from "socket.io";
import {instrument} from "@socket.io/admin-ui";
import { clearScreenDown } from "readline";
import { count } from "console";

const app = express();
const now = new Date();
const mysql = require("mysql");
const dbconfig = require('./config/dbconfig.json');
const axios = require('axios');
const path = require('path')

const API_KEY = '0c4af30e-7bb0-4ddf-aaf0-e8fd77b4df11';
console.log(now.toLocaleTimeString()); 
app.set('view engine', "pug");
app.set("views", __dirname + "/views");
app.set('views', path.join(__dirname, 'views'));
app.use("/public", express.static(__dirname + "/public"));
app.use(express.urlencoded({extended:true}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));
app.get("/", (req,res) => res.render("home"));
app.get("/*", (req,res) => res.render("home"));

const pool = mysql.createPool({
    connectionLimit : 10,
    host: dbconfig.host,
    user: dbconfig.user,
    password: dbconfig.password,
    database: dbconfig.database,
    debug:false
})


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
            done(roomToJoin,"방 없음");
        } else {
            roomToJoin = GroupRoomArr[Math.floor(Math.random() * GroupRoomArr.length)];
            let roomNum = countRoom(GroupChat,roomToJoin)
            if(roomNum >= RoomCap ){
                roomToJoin = roomName || `room_${Math.floor(Math.random() * 1000)}`;
                socket.join(roomToJoin);
                done(roomToJoin,"방 없음");
            }
            else{
                socket.join(roomToJoin);
                done(roomToJoin,"방 있음");
                GroupChat.to(roomToJoin).emit("join", countRoom(GroupChat,roomToJoin));
            }
        }
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
            done(roomToJoin,"방 없음");
        } else {
            roomToJoin = RoomArr[Math.floor(Math.random() * RoomArr.length)];
            let roomNum = countRoom(oneOnoneChat,roomToJoin)
            if(roomNum >= RoomCap ){
                roomToJoin = roomName || `room_${Math.floor(Math.random() * 1000)}`;
                socket.join(roomToJoin);
                done(roomToJoin,"방 없음");
            }
            else{
                socket.join(roomToJoin);
                done(roomToJoin,"방 있음");
                oneOnoneChat.to(roomToJoin).emit("join", countRoom(oneOnoneChat,roomToJoin));
                oneOnoneChat.to(roomToJoin).emit("welcome", socket.nickname, countRoom(oneOnoneChat,roomToJoin));
            }
        }
        oneOnoneChat.emit("room_change", publicGroupRooms(oneOnoneChat));
    });

    socket.on("certify_email", async (email, univName, done) => {
        try {
            const response = await axios.post('https://univcert.com/api/v1/certify', {
                key: API_KEY,
                email: email,
                univName: univName,
                univ_check: true
            });
            done(response.data);
        } catch (error) {
            done({ success: false, error: error.response ? error.response.data : 'Error occurred' });
        }
    });
    socket.on("verify_code", async (email, code, done) => {
        try {
            const response = await axios.post('https://univcert.com/api/v1/certifycode', {
                key: API_KEY,
                email: email,
                code: code
            });
            done(response.data);
        } catch (error) {
            done({ success: false, error: error.response ? error.response.data : 'Error occurred' });
        }
    });

    socket.on("clear_code", async (email, done) => {
        try {
            const response = await axios.post(`https://univcert.com/api/v1/clear/${email}`, {
                key: API_KEY,
            });
            console.log("초기화 됨!")
            done(response.data);
        } catch (error) {
            done({ success: false, error: error.response ? error.response.data : 'Error occurred' });
        }
    });

    socket.on("Login", (email, passwd, done) => {
        pool.getConnection((err, conn) => {
            if (err) {
                conn.release(); // 연결 해제
                console.log('MySQL 연결 오류. 중단됨.');
                done({success : false});
                return;
            }
            const query = 'SELECT * FROM users WHERE user_email = ? AND user_password = ?';
            conn.query(query, [email, passwd], (err, results) => {
                conn.release();
                if (err) {
                    console.log("쿼리 실행 오류:", err);
                    done({success : false});
                    return;
                }
                if (results.length > 0) {
                    //console.log("로그인 성공:", results);
                    done({success : true});
                } else {
                    console.log("로그인 실패: 해당 사용자 없음.");
                    done({success : false});
                }
            });
        });
    });

    socket.on("adduser", (email,passwd,nickname,done)=>{
        pool.getConnection((err,conn)=>{
            if(err){
                conn.release();
                console.log('Mysql getConnection error. aborted');
                done()
                return;
            }
            //console.log("데베 연결됨.");
            console.log(email, passwd , nickname)
            conn.query(
                'INSERT INTO users (user_email, user_password, user_nickname, user_active) VALUES (?,?,?,?)',
                [email, passwd, nickname, true],
                (err, result)=>{
                    conn.release();
                    //console.log("쿼리문 실행됨.")
                    if(err){
                        console.log(err);
                        console.log("쿼리문 오류발생");
                        return;
                    }
                    console.log("사용자 추가됨!",result)
                    done();
                }
            )
        })
    })

    socket.on("disconnecting", () => {
        socket.rooms.forEach((room) => socket.to(room).emit("bye", socket.nickname, countRoom(oneOnoneChat,room) - 1));
    });
    
    socket.on("leave_room", (roomName) => {
        socket.rooms.forEach((room) => {
            socket.to(room).emit("bye", socket.nickname, countRoom(oneOnoneChat, room) - 1);
        });

        socket.emit("room_change", publicGroupRooms(oneOnoneChat));
        socket.leave(roomName); 
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
