import express from "express";
import http from "http";
import {Server} from "socket.io";
import {instrument} from "@socket.io/admin-ui";
import { clearScreenDown } from "readline";
import { count } from "console";
import { connect } from "http2";

const app = express();
const now = new Date();
const mysql = require("mysql");
const dbconfig = require('./config/dbconfig.json');
const axios = require('axios');
const path = require('path')
const activeUsers = {};
const bcrypt = require("bcrypt");
const saltRounds = 5;


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
            //console.log("조회된 이메일:", userEmails);
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
        
        console.log(email);
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

    socket.on("isLogin",(email,done)=>{
        if(activeUsers[email]){
            done(true);
        }
        else{
            done(false);
        }
    })

    socket.on("Login", (email, passwd, done) => {
        if (activeUsers[email]) {
            // 이미 로그인된 사용자가 있으면 강제 로그아웃 처리
            activeUsers[email].emit("force_logout", "다른 기기에서 로그인하여 로그아웃되었습니다.");
        }
    
        pool.getConnection((err, conn) => {
            if (err) {
                console.log("MySQL 연결 오류. 중단됨.");
                done({ success: false });
                return;
            }
    
            const query = "SELECT user_password FROM users WHERE user_email = ?";
            conn.query(query, [email], (err, results) => {
                conn.release();
                if (err) {
                    console.log("쿼리 실행 오류:", err);
                    done({ success: false });
                    return;
                }
    
                if (results.length > 0) {
                    const hashedPassword = results[0].user_password; // DB에 저장된 해싱된 비밀번호
    
                    bcrypt.compare(passwd, hashedPassword, (err, isMatch) => {
                        if (err) {
                            console.log("비밀번호 비교 중 오류 발생:", err);
                            done({ success: false });
                            return;
                        }
    
                        if (isMatch) {
                            activeUsers[email] = socket;
                            socket.email = email;
                            console.log("로그인 성공!");
                            done({ success: true });
                        } else {
                            console.log("로그인 실패: 비밀번호 불일치.");
                            done({ success: false });
                        }
                    });
                } else {
                    console.log("로그인 실패: 해당 이메일 없음.");
                    done({ success: false });
                }
            });
        });
    });
    

    socket.on("adduser", (email, passwd, nickname, done) => {
        bcrypt.hash(passwd, saltRounds, (err, hashedPassword) => {
            if (err) {
                console.error("비밀번호 해싱 중 오류 발생:", err);
                done({ success: false, error: "비밀번호 해싱 실패" });
                return;
            }
    
            pool.getConnection((err, conn) => {
                if (err) {
                    conn.release();
                    console.log("MySQL 연결 오류. 중단됨.");
                    done({ success: false });
                    return;
                }
    
                conn.query(
                    "INSERT INTO users (user_email, user_password, user_nickname, user_active) VALUES (?, ?, ?, ?)",
                    [email, hashedPassword, nickname, true],
                    (err, result) => {
                        conn.release();
                        if (err) {
                            console.error("회원가입 중 오류 발생:", err);
                            done({ success: false });
                            return;
                        }
                        console.log("사용자 추가됨!", result);
                        done({ success: true });
                    }
                );
            });
        });
    });

    socket.on("leave_room", () => {
        // socket.rooms에는 해당 소켓의 모든 방(ID 포함)이 들어있으므로,
        // 기본 socket.id는 제외하고 실제 채팅방들에 대해서만 처리합니다.
        socket.rooms.forEach((room) => {
            if (room === socket.id) return; // 기본 룸은 건너뛰기

            // 현재 방에 속한 소켓의 수 (disconnecting 이벤트 시 소켓은 아직 포함되어 있음)
            const currentCount = countRoom(oneOnoneChat, room) || 0;
            
            // 1대1 채팅에서는 currentCount가 2라면, 나가는 후 남은 사용자는 1명이 됨
            if (currentCount === 2) {
                // 남은 소켓에게 'bye' 이벤트를 보내 메시지를 전달
                socket.to(room).emit("bye", "상대방이 퇴장하였습니다.");
                // 1초 후에 남은 소켓을 강제로 방에서 탈출시키고, 'room_closed' 이벤트를 전송
                setTimeout(async () => {
                    const sockets = await oneOnoneChat.in(room).fetchSockets();
                    sockets.forEach(s => {
                        s.leave(room);
                        s.emit("room_closed", "방이 종료되었습니다.");
                    });
                }, 1000);
            } else {
                // 2명 이상의 경우 (혹은 기타 상황) 기존 로직 그대로 처리
                socket.to(room).emit("bye", socket.nickname, currentCount - 1);
            }
        });
    });
    /*
    socket.on("leave_room", (roomName) => {
        socket.rooms.forEach((room) => {
            socket.to(room).emit("bye", socket.nickname, countRoom(oneOnoneChat, room) - 1);
        });

        socket.emit("room_change", publicGroupRooms(oneOnoneChat));
        socket.leave(roomName); 
    });*/

    socket.on("disconnect", () => {
        if (socket.email && activeUsers[socket.email] === socket) {
            delete activeUsers[socket.email];
        }
        oneOnoneChat.emit("room_change", publicGroupRooms(oneOnoneChat));
    });

    socket.on("new_message", (msg, room, done) => {
        socket.to(room).emit("new_message", `${socket.nickname}: ${msg}`);
        done();
    });

    socket.on("new_note",(value,friend,email,done)=>{
        const query = `INSERT INTO messages (sender_email, receiver_email, message_content) VALUES (?, ?, ?)`;
        pool.getConnection((err,connection) => {
            if(err){
                console.log("쪽지 내역 저장중 오류 발생.",err);
                return;
            }
            connection.query(query,[email,friend,value],(error,results)=>{
                connection.release();
                if(error){
                    console.log("쪽지 저장 쿼리문 실행 중 오류발생",error);
                    return;
                }
                done();
            })
        })
    })

    socket.on("ShowNote", (friendEmail, myEmail, done) => {
        const query = `
          SELECT message_content, sent_at, sender_email, receiver_email
          FROM messages
          WHERE (sender_email = ? AND receiver_email = ?)
             OR (sender_email = ? AND receiver_email = ?)
          ORDER BY sent_at ASC
        `;
        pool.getConnection((err, connection) => {
          if (err) {
            console.log("메시지 내역 가져오는 중 오류 발생.", err);
            return;
          }
          connection.query(
            query,
            [myEmail, friendEmail, friendEmail, myEmail],
            (error, result) => {
              connection.release();
              if (error) {
                console.log("메시지 가져오는 쿼리문 실행 중 오류발생.", error);
                return;
              }
              const messageContents = result.map(row => row.message_content);
              done(messageContents);
            }
          );
        });
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

    socket.on("ShowFriend", (callback) => {
        const email = socket.email;
        pool.getConnection((err, connection) => {
            if (err) {
                console.error('DB 연결 오류:', err);
                return callback(err);
            }
    
            const query = 'SELECT * FROM friends WHERE user_email = ? OR friend_email = ?';
            connection.query(query, [email, email], (error, results) => {
                if (error) {
                    connection.release();
                    console.error('친구 목록 조회 중 오류 발생:', error);
                    return callback(error);
                }
    
                const friendList = results.map(row => {
                    return row.user_email === email ? row.friend_email : row.user_email;
                });
    
                if (friendList.length === 0) {
                    connection.release();
                    return callback([]);  // 친구가 없는 경우 빈 배열 반환
                }
    
                // 친구들의 닉네임을 조회하기 위한 쿼리
                const query = `SELECT user_nickname FROM users WHERE user_email IN (?)`;
                connection.query(query, [friendList], (error, results) => {
                    connection.release();
    
                    if (error) {
                        console.error('닉네임 조회 중 오류 발생:', error);
                        return callback(error);
                    }
    
                    // 친구들의 닉네임을 배열로 반환
                    const nicknames = results.map(row => row.user_nickname);
                    callback(nicknames);
                });
            });
        });
    });

    socket.on("FriendChat", (friendName, done) => {
        pool.getConnection((err, connection) => {
            if (err) {
                console.log("DB 연결 오류 FriendChat", err);
                return;
            }
            
            // 먼저 friendName에 해당하는 이메일을 가져옵니다.
            const queryEmail = 'SELECT user_email FROM users WHERE user_nickname = ?';
            connection.query(queryEmail, [friendName], (error, results) => {
                if (error) {
                    console.log("이메일 조회 중 오류발생:", error);
                    connection.release();
                    return;
                }
                
                if (results.length > 0) {
                    const friendEmail = results[0].user_email;
                    
                    // 하나의 쿼리문으로 양방향 메시지를 조회합니다.
                    const queryMessages = `
                        SELECT message_content, sent_at, sender_email
                        FROM messages
                        WHERE (sender_email = ? AND receiver_email = ?)
                           OR (sender_email = ? AND receiver_email = ?)
                        ORDER BY sent_at ASC
                    `;
                    connection.query(queryMessages, [socket.email, friendEmail, friendEmail, socket.email], (msgError, msgResults) => {
                        if (msgError) {
                            console.log("메시지 조회 중 오류 발생:", msgError);
                            connection.release();
                            return;
                        }
                        
                        if (msgResults.length > 0) {
                            // msgResults의 각 항목에는 message_content, sent_at, sender_email이 포함됩니다.
                            done(msgResults, friendEmail);
                        } else {
                            console.log("조회된 메시지가 없습니다.");
                            done([], friendEmail);
                        }
                        connection.release();
                    });
                } else {
                    console.log("닉네임에 해당하는 이메일을 찾지 못했습니다.");
                    connection.release();
                }
            });
        });
    });
    

    socket.on("nickname", (nickname) => {
        socket["nickname"] = nickname;
    });
});
