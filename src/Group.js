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

function getRoomUserEmails(roomName, namespace, callback) {
    console.log("방의 유저 이메일 조회 시도 중...");

    // 현재 룸에 있는 소켓 ID들을 가져옴
    const room = namespace.adapter.rooms.get(roomName);
    if (!room) {
        console.log("룸이 존재하지 않음.");
        return callback([]);  // 빈 배열을 콜백으로 전달
    }

    const socketIds = Array.from(room); // 소켓 ID를 배열로 변환
    const emailsToFetch = socketIds.map(socketId => {
        const socket = namespace.sockets.get(socketId);
        return socket ? socket.email : null;
    }).filter(email => email !== null); // null 값 제거

    if (emailsToFetch.length === 0) {
        console.log("조회할 이메일이 없음.");
        return callback([]); // 빈 배열을 콜백으로 전달
    }

    // MySQL 연결 풀에서 연결 가져오기
    pool.getConnection((err, connection) => {
        if (err) {
            console.error('DB 연결 오류:', err);
            return callback([]);
        }

        // 소켓 ID를 통해 이메일을 조회하기 위한 SQL 쿼리
        const query = 'SELECT user_email FROM users WHERE user_email IN (?)';
        connection.query(query, [emailsToFetch], (err, results) => {
            connection.release();
            if (err) {
                console.error('이메일 조회 중 오류 발생:', err);
                return callback([]);
            }

            const userEmails = results.map(row => row.user_email);
            console.log("조회된 이메일:", userEmails);
            callback(userEmails);
        });
    });
}

/*
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
*/

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
                    socket.email = email;
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

    socket.on("friendRequest",(room)=>{
        socket.broadcast.to(room).emit("friendRequest");
    })

    socket.on("addFriend", (roomName) => {
        // getRoomUserEmails를 호출할 때 콜백 함수 사용
        getRoomUserEmails(roomName, oneOnoneChat, (emails) => {
            if (emails.length < 2) {
                console.log("룸에 유저가 충분하지 않습니다.");
                return;
            }
    
            // 배열 구조 분해를 사용하여 이메일을 가져옴
            const [userEmail, friendEmail] = emails;
    
            const query = 'INSERT INTO friends (user_email, friend_email) VALUES (?, ?)';
            pool.getConnection((err, connection) => {
                if (err) {
                    console.log("DB 연결오류 , 친구 추가", err);
                    return;
                }
                connection.query(query, [userEmail, friendEmail], (err, results) => {
                    connection.release();
                    if (err) {
                        console.log("친구 추가 중 오류 발생", err);
                        return;
                    }
                    //console.log("친구가 추가되었습니다", results);
                    oneOnoneChat.to(roomName).emit("FriendAdd");
                });
            });
        });
    });

    socket.on("ShowFriend",(callback)=>{
        const email = socket.email 
        //console.log(email);
        pool.getConnection((err, connection)=>{
            const query = 'SELECT * FROM friends WHERE user_email = ? OR friend_email = ?';
            connection.query(query, [email, email], (error, results) => {
                connection.release();
        
                if (err) {
                    console.error('친구 목록 조회 중 오류 발생:', err);
                    return callback(err, null);
                }
        
                // 조회된 친구 이메일들을 배열로 반환
                const friendList = results.map(row => {
                    // 사용자가 user_email이면 friend_email을 반환하고, 반대의 경우 user_email을 반환
                    return row.user_email === email ? row.friend_email : row.user_email;
                });
                //console.log(friendList);
                callback(friendList);
            });
        })
    })

    socket.on("nickname", (nickname) => {
        socket["nickname"] = nickname;
    });
});
