require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require("express");
const http = require("http");
const {Server} = require ("socket.io");
const {instrument} = require("@socket.io/admin-ui");
const app = express();
const now = new Date();
const mysql = require("mysql");
const fs = require('fs');
const axios = require('axios');
const path = require('path')
const crypto = require('crypto');
const activeUsers = {};
const sessionTokens = new Map();
const bcrypt = require("bcryptjs");
const saltRounds = 10;

const SESSION_COOKIE_NAME = 'uc_sid';
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

const API_KEY = process.env.UNIVCERT_API_KEY;
if (!API_KEY) {
    console.error('[server] Missing required environment variable: UNIVCERT_API_KEY');
    process.exit(1);
}

let dbconfig = {};
try {
    dbconfig = require('./config/dbconfig.json');
} catch {
    dbconfig = {};
}

const PORT = Number(process.env.PORT) || 3001;
const DB_HOST = process.env.DB_HOST || dbconfig.host;
const DB_PORT = Number(process.env.DB_PORT || dbconfig.port || 3306);
const DB_USER = process.env.DB_USER || dbconfig.user;
const DB_PASSWORD = process.env.DB_PASSWORD || dbconfig.password;
const DB_NAME = process.env.DB_NAME || dbconfig.database;
const DB_SSL = (process.env.DB_SSL || 'false').toLowerCase() === 'true';
const DB_SSL_REJECT_UNAUTHORIZED = (process.env.DB_SSL_REJECT_UNAUTHORIZED || 'true').toLowerCase() === 'true';
const DB_SSL_CA_PATH = process.env.DB_SSL_CA_PATH;
const DB_SSL_CA = process.env.DB_SSL_CA;

if (!DB_HOST || !DB_USER || !DB_NAME) {
    console.error('[server] Missing required DB environment values. Check DB_HOST, DB_USER, DB_PASSWORD, DB_NAME');
    process.exit(1);
}

console.log(now.toLocaleTimeString()); 
app.set('view engine', "pug");
app.set('views', path.join(__dirname, 'views'));
app.use("/public", express.static(__dirname + "/public"));
app.use(express.urlencoded({extended:true}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

function parseCookies(cookieHeader = '') {
    const result = {};
    cookieHeader.split(';').forEach((part) => {
        const [rawKey, ...rawValue] = part.trim().split('=');
        if (!rawKey) return;
        result[rawKey] = decodeURIComponent(rawValue.join('='));
    });
    return result;
}

function setSessionCookie(res, token) {
    const isSecure = process.env.NODE_ENV === 'production';
    const cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_MAX_AGE_MS / 1000)}${isSecure ? '; Secure' : ''}`;
    res.setHeader('Set-Cookie', cookie);
}

function clearSessionCookie(res) {
    const isSecure = process.env.NODE_ENV === 'production';
    const cookie = `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isSecure ? '; Secure' : ''}`;
    res.setHeader('Set-Cookie', cookie);
}

function verifyUserPassword(email, passwd) {
    return new Promise((resolve) => {
        pool.getConnection((err, conn) => {
            if (err) {
                console.log("MySQL 연결 오류. 중단됨.");
                resolve({ success: false });
                return;
            }

            const query = "SELECT user_password FROM users WHERE user_email = ?";
            conn.query(query, [email], (queryErr, results) => {
                conn.release();
                if (queryErr) {
                    console.log("쿼리 실행 오류:", queryErr);
                    resolve({ success: false });
                    return;
                }

                if (results.length === 0) {
                    resolve({ success: false });
                    return;
                }

                const hashedPassword = results[0].user_password;
                bcrypt.compare(passwd, hashedPassword, (compareErr, isMatch) => {
                    if (compareErr) {
                        console.log("비밀번호 비교 중 오류 발생:", compareErr);
                        resolve({ success: false });
                        return;
                    }

                    resolve({ success: isMatch });
                });
            });
        });
    });
}

function requireAuth(req, res, next) {
    const cookies = parseCookies(req.headers.cookie || '');
    const token = cookies[SESSION_COOKIE_NAME];
    const session = resolveSessionToken(token);
    if (!session) {
        return res.redirect('/login');
    }
    req.userSession = session;
    next();
}

app.get("/", (req,res) => res.render("home"));
app.get("/login", (req,res) => res.render("login"));
app.get("/signup", (req,res) => res.render("signup"));
app.get("/lobby", requireAuth, (req,res) => res.render("lobby"));
app.get("/chat/random", requireAuth, (req,res) => res.render("chat-random"));
app.get("/chat/friend", requireAuth, (req,res) => {
    const friendName = (req.query.friend || "친구").toString();
    res.render("chat-friend", { friendName });
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
        res.status(400).json({ success: false, error: 'invalid payload' });
        return;
    }

    const cookies = parseCookies(req.headers.cookie || '');
    const existingToken = cookies[SESSION_COOKIE_NAME];
    const existingSession = resolveSessionToken(existingToken);

    // 동일 브라우저(동일 쿠키)에서 다른 계정으로 덮어 로그인하면
    // 기존 탭/페이지 계정이 뒤바뀌며 강제 로그아웃 연쇄가 발생할 수 있으므로 차단합니다.
    if (existingSession && existingSession.email !== email) {
        res.status(409).json({
            success: false,
            error: 'session_conflict',
            message: '현재 브라우저에 다른 계정이 로그인되어 있습니다. 먼저 로그아웃 후 다시 시도해주세요.',
        });
        return;
    }

    const verified = await verifyUserPassword(email, password);
    if (!verified.success) {
        res.status(401).json({ success: false });
        return;
    }

    const token = issueSessionToken(email);
    setSessionCookie(res, token);
    res.json({ success: true, email });
});

app.get('/api/auth/session', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const cookies = parseCookies(req.headers.cookie || '');
    const token = cookies[SESSION_COOKIE_NAME];
    const session = resolveSessionToken(token);

    if (!session) {
        res.status(401).json({ success: false });
        return;
    }

    res.json({ success: true, email: session.email });
});

app.post('/api/auth/logout', (req, res) => {
    const cookies = parseCookies(req.headers.cookie || '');
    const token = cookies[SESSION_COOKIE_NAME];
    if (token) {
        sessionTokens.delete(token);
    }
    clearSessionCookie(res);
    res.json({ success: true });
});

app.get("/*", (req,res) => res.render("home"));


const mysqlPoolConfig = {
    connectionLimit : 10,
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    debug:false,
    charset: 'utf8mb4'
};

if (DB_SSL) {
    mysqlPoolConfig.ssl = {
        rejectUnauthorized: DB_SSL_REJECT_UNAUTHORIZED,
    };

    if (DB_SSL_CA) {
        mysqlPoolConfig.ssl.ca = DB_SSL_CA;
    } else if (DB_SSL_CA_PATH) {
        try {
            mysqlPoolConfig.ssl.ca = fs.readFileSync(DB_SSL_CA_PATH, 'utf8');
        } catch (error) {
            console.error('[server] Failed to read DB_SSL_CA_PATH file:', error.message);
            process.exit(1);
        }
    }
}

const pool = mysql.createPool(mysqlPoolConfig);


console.log("Group.js 실행됨!");
const handleListen = () => console.log(`Listening on http://localhost:${PORT}`);

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

GrouphttpServer.on("error", (error) => {
    if (error && error.code === "EADDRINUSE") {
        console.error(`\n[server] Port ${PORT} is already in use.`);
        console.error("[server] Run \"npm run kill\" and then restart with \"npm run dev\".\n");
        process.exit(1);
    }

    console.error("[server] Unhandled server error:", error);
    process.exit(1);
});

GrouphttpServer.listen(PORT,handleListen);

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

function areUsersAlreadyFriends(userEmail, friendEmail, callback) {
    if (!userEmail || !friendEmail) {
        callback(false);
        return;
    }

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('친구 관계 확인 중 DB 연결 오류:', err);
            callback(false);
            return;
        }

        const query = `
            SELECT 1
            FROM friends
            WHERE (user_email = ? AND friend_email = ?)
               OR (user_email = ? AND friend_email = ?)
            LIMIT 1
        `;

        connection.query(query, [userEmail, friendEmail, friendEmail, userEmail], (queryErr, results) => {
            connection.release();

            if (queryErr) {
                console.error('친구 관계 확인 쿼리 오류:', queryErr);
                callback(false);
                return;
            }

            callback(results.length > 0);
        });
    });
}

function issueSessionToken(email) {
    // 기존 이메일 토큰 정리 (단일 세션 정책)
    for (const [token, value] of sessionTokens.entries()) {
        if (value?.email === email) {
            sessionTokens.delete(token);
        }
    }

    const token = crypto.randomBytes(24).toString('hex');
    sessionTokens.set(token, { email, issuedAt: Date.now() });
    return token;
}

function resolveSessionToken(token) {
    if (!token) return null;
    const session = sessionTokens.get(token);
    if (!session) return null;

    if (Date.now() - session.issuedAt > SESSION_MAX_AGE_MS) {
        sessionTokens.delete(token);
        return null;
    }

    return session;
}

function bindAuthenticatedSocket(socket, email, sessionToken = null) {
    if (!email) return;

    if (activeUsers[email] && activeUsers[email] !== socket) {
        const previousSocket = activeUsers[email];
        const sameSession = !!sessionToken && previousSocket.sessionToken === sessionToken;

        if (!sameSession) {
            previousSocket.disconnect(true);
        }
    }

    activeUsers[email] = socket;
    socket.email = email;
    socket.sessionToken = sessionToken;
}

function bootstrapSocketSession(socket) {
    const cookies = parseCookies(socket.handshake?.headers?.cookie || '');
    const token = cookies[SESSION_COOKIE_NAME];
    const session = resolveSessionToken(token);
    if (!session) return;

    bindAuthenticatedSocket(socket, session.email, token);
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
    socket._roomLeft = false;
    bootstrapSocketSession(socket);

    if (socket.email) {
        socket.emit("session_bound", { email: socket.email });
    }

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

    socket.on("clear_code", async (done) => {
        try {
            const response = await axios.post('https://univcert.com/api/v1/clear', {
                key: API_KEY,
            });
            console.log("초기화 됨!")
            done(response.data);
        } catch (error) {
            done({ success: false, error: error.response ? error.response.data : 'Error occurred' });
        }
    });

    socket.on("isLogin",(email,done)=>{
        // 자신의 이메일인 경우에만 로그인 상태 확인 허용
        if (socket.email && socket.email !== email) {
            done(false);
            return;
        }
        if(activeUsers[email]){
            done(true);
        }
        else{
            done(false);
        }
    })

    socket.on("Login", async (email, passwd, done) => {
        const verified = await verifyUserPassword(email, passwd);
        if (!verified.success) {
            done({ success: false });
            return;
        }

        const token = issueSessionToken(email);
        bindAuthenticatedSocket(socket, email, token);
        socket.emit("session_bound", { email });
        console.log("로그인 성공!");
        done({ success: true, email, sessionToken: token });
    });

    socket.on("resume_session", (sessionToken, done) => {
        const session = resolveSessionToken(sessionToken);
        if (!session) {
            done({ success: false });
            return;
        }

        bindAuthenticatedSocket(socket, session.email, sessionToken);
        socket.emit("session_bound", { email: session.email });
        done({ success: true, email: session.email });
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

    socket.on("logout", (done) => {
        try {
            if (socket.email && activeUsers[socket.email] === socket) {
                delete activeUsers[socket.email];
            }
            if (socket.sessionToken) {
                sessionTokens.delete(socket.sessionToken);
            }
            socket.email = null;
            socket.sessionToken = null;
            if (typeof done === "function") {
                done({ success: true });
            }
        } catch (error) {
            if (typeof done === "function") {
                done({ success: false, error: "logout failed" });
            }
        }
    });

    socket.on("leave_room", () => {
        socket._roomLeft = true;
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

    socket.on("disconnecting", () => {
        // leave_room 이벤트가 처리되지 않은 채 연결이 끊긴 경우(브라우저 이탈 등)
        // 방에 남은 상대방에게 알림을 보냅니다.
        if (socket._roomLeft) return;
        socket.rooms.forEach((room) => {
            if (room === socket.id) return;
            const currentCount = countRoom(oneOnoneChat, room) || 0;
            if (currentCount >= 2) {
                socket.to(room).emit("bye", "상대방이 연결을 종료했습니다.");
                setTimeout(async () => {
                    const sockets = await oneOnoneChat.in(room).fetchSockets();
                    sockets.forEach((s) => {
                        if (s.id !== socket.id) {
                            s.leave(room);
                            s.emit("room_closed", "상대방이 나가 방이 종료되었습니다.");
                        }
                    });
                }, 1000);
            }
        });
    });

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

    socket.on("new_note", (value, friend, maybeEmailOrDone, maybeDone) => {
        const done = typeof maybeEmailOrDone === 'function' ? maybeEmailOrDone : maybeDone;
        const senderEmail = socket.email;

        if (!senderEmail || !friend || !value) {
            if (typeof done === 'function') done({ success: false, error: 'invalid payload' });
            return;
        }

        const query = `INSERT INTO messages (sender_email, receiver_email, message_content) VALUES (?, ?, ?)`;
        pool.getConnection((err, connection) => {
            if(err){
                console.log("쪽지 내역 저장중 오류 발생.", err);
                if (typeof done === 'function') done({ success: false });
                return;
            }
            connection.query(query, [senderEmail, friend, value], (error) => {
                connection.release();
                if(error){
                    console.log("쪽지 저장 쿼리문 실행 중 오류발생", error);
                    if (typeof done === 'function') done({ success: false, error: '쪽지 저장 실패' });
                    return;
                }
                if (typeof done === 'function') done({ success: true });
            })
        })
    })

    socket.on("ShowNote", (friendEmail, maybeMyEmailOrDone, maybeDone) => {
        const done = typeof maybeMyEmailOrDone === 'function' ? maybeMyEmailOrDone : maybeDone;
        const myEmail = socket.email;

        if (!myEmail || !friendEmail) {
          if (typeof done === 'function') done([]);
          return;
        }

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
            if (typeof done === 'function') done([]);
            return;
          }
          connection.query(
            query,
            [myEmail, friendEmail, friendEmail, myEmail],
            (error, result) => {
              connection.release();
              if (error) {
                console.log("메시지 가져오는 쿼리문 실행 중 오류발생.", error);
                                if (typeof done === 'function') done([]);
                return;
              }
              const messageContents = result.map(row => row.message_content);
                            if (typeof done === 'function') done(messageContents);
            }
          );
        });
      });

    socket.on("friendRequest", (room, done) => {
        getRoomUserEmails(room, oneOnoneChat, (emails) => {
            if (emails.length < 2) {
                if (typeof done === 'function') {
                    done({ success: false, error: '상대방 정보를 찾을 수 없습니다.' });
                }
                return;
            }

            const requesterEmail = socket.email;
            const friendEmail = emails.find((email) => email !== requesterEmail);

            areUsersAlreadyFriends(requesterEmail, friendEmail, (alreadyFriends) => {
                if (alreadyFriends) {
                    if (typeof done === 'function') {
                        done({ success: false, reason: 'already_friends' });
                    }
                    return;
                }

                socket.broadcast.to(room).emit("friendRequest");
                if (typeof done === 'function') {
                    done({ success: true });
                }
            });
        });
    })

    socket.on("addFriend", (roomName, done) => {
        // getRoomUserEmails를 호출할 때 콜백 함수 사용
        getRoomUserEmails(roomName, oneOnoneChat, (emails) => {
            if (emails.length < 2) {
                console.log("룸에 유저가 충분하지 않습니다.");
                if (typeof done === 'function') {
                    done({ success: false, error: '룸에 유저가 충분하지 않습니다.' });
                }
                return;
            }
    
            // 배열 구조 분해를 사용하여 이메일을 가져옴
            const [userEmail, friendEmail] = emails;

            areUsersAlreadyFriends(userEmail, friendEmail, (alreadyFriends) => {
                if (alreadyFriends) {
                    if (typeof done === 'function') {
                        done({ success: false, reason: 'already_friends' });
                    }
                    return;
                }

                const query = 'INSERT INTO friends (user_email, friend_email) VALUES (?, ?)';
                pool.getConnection((err, connection) => {
                    if (err) {
                        console.log("DB 연결오류 , 친구 추가", err);
                        if (typeof done === 'function') {
                            done({ success: false, error: 'DB 연결 오류' });
                        }
                        return;
                    }
                    connection.query(query, [userEmail, friendEmail], (err, results) => {
                        connection.release();
                        if (err) {
                            console.log("친구 추가 중 오류 발생", err);
                            if (typeof done === 'function') {
                                done({ success: false, error: '친구 추가 중 오류가 발생했습니다.' });
                            }
                            return;
                        }
                        //console.log("친구가 추가되었습니다", results);
                        oneOnoneChat.to(roomName).emit("FriendAdd");
                        if (typeof done === 'function') {
                            done({ success: true });
                        }
                    });
                });
            });
        });
    });

    socket.on("ShowFriend", (callback) => {
        const email = socket.email;
        pool.getConnection((err, connection) => {
            if (err) {
                console.error('DB 연결 오류:', err);
                return callback([]);
            }
    
            const query = 'SELECT * FROM friends WHERE user_email = ? OR friend_email = ?';
            connection.query(query, [email, email], (error, results) => {
                if (error) {
                    connection.release();
                    console.error('친구 목록 조회 중 오류 발생:', error);
                    return callback([]);
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
                        return callback([]);
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
                if (typeof done === 'function') done([], null);
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
