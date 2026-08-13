require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require("express");
const http = require("http");
const {Server} = require ("socket.io");
const {instrument} = require("@socket.io/admin-ui");
const app = express();

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

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;
if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    console.error('[server] Missing required environment variables: RESEND_API_KEY and RESEND_FROM_EMAIL');
    process.exit(1);
}

const VERIFICATION_TTL_MS = 5 * 60 * 1000;
const VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;
const VERIFICATION_MAX_ATTEMPTS = 5;
const verificationChallenges = new Map();
const verifiedEmails = new Map();
const verificationRequestsByIp = new Map();
const DEFAULT_UNIVERSITY_DOMAINS = {
  // 서울·수도권
  '한국외국어대학교': ['hufs.ac.kr'],
  '홍익대학교': ['mail.hongik.ac.kr', 'g.hongik.ac.kr'],
  '동국대학교': ['dgu.ac.kr'],
  '연세대학교': ['o365.yonsei.ac.kr', 'yonsei.ac.kr'],
  '고려대학교': ['korea.ac.kr'],
  '서울대학교': ['snu.ac.kr'],
  '성균관대학교': ['skku.edu', 'g.skku.edu'],
  '한양대학교': ['hanyang.ac.kr'],
  '서강대학교': ['u.sogang.ac.kr'],
  '경희대학교': ['khu.ac.kr'],
  '서울시립대학교': ['uos.ac.kr'],
  '건국대학교': ['konkuk.ac.kr'],
  '이화여자대학교': ['ewha.ac.kr', 'ewhain.net'],
  '숙명여자대학교': ['sookmyung.ac.kr'],
  '국민대학교': ['kookmin.ac.kr', 'kookmin.kr'],
  '숭실대학교': ['soongsil.ac.kr'],
  '세종대학교': ['sju.ac.kr'],
  '광운대학교': ['kw.ac.kr'],
  '아주대학교': ['ajou.ac.kr'],
  '인하대학교': ['inha.edu'],
  '가천대학교': ['gc.gachon.ac.kr'],
  '명지대학교': ['mju.ac.kr'],
  '성신여자대학교': [
    'sungshin.ac.kr',
    'student.sungshin.ac.kr',
  ],
  '중앙대학교': ['cau.ac.kr'],

  // 지역 국립대·사립대
  '부산대학교': ['pusan.ac.kr'],
  '경북대학교': ['knu.ac.kr'],
  '전남대학교': ['jnu.ac.kr'],
  '전북대학교': ['jbnu.ac.kr'],
  '충남대학교': ['o.cnu.ac.kr', 'g.cnu.ac.kr'],
  '강원대학교': ['kangwon.ac.kr'],
  '제주대학교': ['stu.jejunu.ac.kr'],
  '국립부경대학교': ['pukyong.ac.kr'],
  '인천대학교': ['inu.ac.kr'],
  '충북대학교': ['chungbuk.ac.kr'],
  '국립공주대학교': ['smail.kongju.ac.kr'],
  '경상국립대학교': ['gnu.ac.kr'],
  '계명대학교': ['stu.kmu.ac.kr'],
  '영남대학교': ['yu.ac.kr', 'ynu.ac.kr'],
  '동아대학교': ['donga.ac.kr'],
  '울산대학교': ['mail.ulsan.ac.kr'],
  '조선대학교': ['chosun.ac.kr', 'chosun.kr'],

  // 과학기술특성화대학
  '한국과학기술원': ['kaist.ac.kr'],
  '포항공과대학교': ['postech.ac.kr'],
  '울산과학기술원': ['unist.ac.kr'],
  '광주과학기술원': ['gm.gist.ac.kr'],
  '대구경북과학기술원': ['dgist.ac.kr'],

  // 전문대·기타
  '동양미래대학교': ['dongyang.ac.kr'],
  '경기과학기술대학교': ['office.gtec.ac.kr'],
  '대림대학교': ['email.daelim.ac.kr'],
  '성공회대학교': ['office.skhu.ac.kr'],
  '동명대학교': ['g.tu.ac.kr', 'o365.tu.ac.kr'],

    '단국대학교': ['dankook.ac.kr'],
    '가톨릭대학교': ['catholic.ac.kr'],
    '덕성여자대학교': ['duksung.ac.kr'],
    '동덕여자대학교': ['dongduk.ac.kr'],
    '삼육대학교': ['syuin.ac.kr'],

    // Google 메일과 Microsoft 365 주소가 다름
    '한성대학교': ['hansung.ac.kr', 'hansung.edu'],

    '서울과학기술대학교': ['seoultech.ac.kr'],

    // Google Workspace / Microsoft 365
    '한밭대학교': ['edu.hanbat.ac.kr', 'o365.hanbat.ac.kr'],

    '국립창원대학교': ['gs.cwnu.ac.kr'],
    '국립한국해양대학교': ['g.kmou.ac.kr'],
    '국립목포대학교': ['365.mokpo.ac.kr'],
    '국립순천대학교': ['s.scnu.ac.kr'],

    '국립군산대학교': [
        'kunsan.ac.kr',
        'office365.kunsan.ac.kr',
    ],

    '한림대학교': [
        'hallym.ac.kr',
        'microsoft.hallym.ac.kr',
    ],

    '강남대학교': ['kangnam.ac.kr'],
    '안양대학교': ['gs.anyang.ac.kr'],
    '호서대학교': ['vision.hoseo.edu'],
    '한남대학교': ['m365.hnu.ac.kr'],
    '목원대학교': ['mokwon.ac.kr'],
    '동서대학교': ['office.dongseo.ac.kr'],
    '동의대학교': ['office.deu.ac.kr', 'g.deu.ac.kr'],
    '신라대학교': ['sillain.ac.kr'],
    '원광대학교': ['wku.ac.kr'],
    '호남대학교': ['honam.ac.kr'],

    '경기대학교': ['kyonggi.ac.kr'],
    '서울여자대학교': ['swu.ac.kr'],
    '수원대학교': ['suwon.ac.kr'],
    '국립금오공과대학교': ['kumoh.ac.kr'],
    '순천향대학교': ['sch.ac.kr'],
    '한국기술교육대학교': ['koreatech.ac.kr'],
};

let universityDomains = DEFAULT_UNIVERSITY_DOMAINS;
if (process.env.UNIVERSITY_DOMAINS) {
    try {
        universityDomains = JSON.parse(process.env.UNIVERSITY_DOMAINS);
    } catch (error) {
        console.error('[server] UNIVERSITY_DOMAINS must be valid JSON:', error.message);
        process.exit(1);
    }
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

function normalizeEmail(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function sanitizeText(value, maxLength = 500) {
    if (typeof value !== 'string') return '';
    const trimmed = value.replace(/\r?\n/g, ' ').trim();
    return trimmed.slice(0, maxLength);
}

function sanitizeNickname(value) {
    const sanitized = sanitizeText(value, 30);
    return sanitized.replace(/[<>]/g, '');
}

function getEmailDomain(email) {
    const parts = normalizeEmail(email).split('@');
    return parts.length === 2 ? parts[1] : '';
}

function isUniversityEmail(email, universityName) {
    const domains = universityDomains[sanitizeText(universityName, 100)];
    const emailDomain = getEmailDomain(email);
    return Array.isArray(domains) && domains.some((domain) => {
        const normalizedDomain = String(domain).trim().toLowerCase();
        return emailDomain === normalizedDomain;
    });
}

function getSocketIp(socket) {
    return socket.handshake?.address || 'unknown';
}

function createVerificationCode() {
    return String(crypto.randomInt(100000, 1000000));
}

function hashVerificationCode(email, code) {
    return crypto
        .createHmac('sha256', RESEND_API_KEY)
        .update(`${normalizeEmail(email)}:${code}`)
        .digest('hex');
}

function cleanupVerificationState() {
    const now = Date.now();
    for (const [email, challenge] of verificationChallenges.entries()) {
        if (!challenge || challenge.expiresAt <= now) {
            verificationChallenges.delete(email);
        }
    }
    for (const [ip, requestedAt] of verificationRequestsByIp.entries()) {
        if (requestedAt <= now - VERIFICATION_RESEND_COOLDOWN_MS) {
            verificationRequestsByIp.delete(ip);
        }
    }
    for (const [email, verifiedAt] of verifiedEmails.entries()) {
        if (verifiedAt <= now - VERIFICATION_TTL_MS) {
            verifiedEmails.delete(email);
        }
    }
}

async function sendVerificationEmail(email, code, universityName) {
    return axios.post('https://api.resend.com/emails', {
        from: RESEND_FROM_EMAIL,
        to: [email],
        subject: `[언노운] ${universityName} 이메일 인증번호`,
        html: `<p>인증번호는 <strong>${code}</strong>입니다.</p><p>인증번호는 5분 동안 유효합니다.</p>`,
    }, {
        headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
        },
        timeout: 10000,
    });
}

function purgeExpiredSessions() {
    const now = Date.now();
    for (const [token, session] of sessionTokens.entries()) {
        if (!session || !session.issuedAt || now - session.issuedAt > SESSION_MAX_AGE_MS) {
            sessionTokens.delete(token);
        }
    }
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
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !passwd) {
        return Promise.resolve({ success: false });
    }

    return new Promise((resolve) => {
        pool.getConnection((err, conn) => {
            if (err) {
                console.log("MySQL 연결 오류. 중단됨.");
                resolve({ success: false });
                return;
            }

            const query = "SELECT user_password FROM users WHERE LOWER(user_email) = ?";
            conn.query(query, [normalizedEmail], (queryErr, results) => {
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
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !password) {
        res.status(400).json({ success: false, error: 'invalid payload' });
        return;
    }

    const cookies = parseCookies(req.headers.cookie || '');
    const existingToken = cookies[SESSION_COOKIE_NAME];
    const existingSession = resolveSessionToken(existingToken);

    // 동일 브라우저(동일 쿠키)에서 다른 계정으로 덮어 로그인하면
    // 기존 탭/페이지 계정이 뒤바뀌며 강제 로그아웃 연쇄가 발생할 수 있으므로 차단합니다.
    if (existingSession && existingSession.email !== normalizedEmail) {
        res.status(409).json({
            success: false,
            error: 'session_conflict',
            message: '현재 브라우저에 다른 계정이 로그인되어 있습니다. 먼저 로그아웃 후 다시 시도해주세요.',
        });
        return;
    }

    const verified = await verifyUserPassword(normalizedEmail, password);
    if (!verified.success) {
        res.status(401).json({ success: false });
        return;
    }

    const token = issueSessionToken(normalizedEmail);
    setSessionCookie(res, token);
    res.json({ success: true, email: normalizedEmail });
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
//const GroupChat = io.of("/group");
const oneOnoneChat = io.of("/oneonone");
const roomMetadata = new Map();

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

function createRoomName() {
    return `room_${crypto.randomBytes(8).toString('hex')}`;
}

function normalizeRoomOptions(maxCap, optionsOrDone, maybeDone) {
    const done = typeof optionsOrDone === 'function' ? optionsOrDone : maybeDone;
    const options = typeof optionsOrDone === 'object' && optionsOrDone !== null ? optionsOrDone : {};
    const mode = options.mode === 'group' ? 'group' : 'one';
    const defaultCapacity = mode === 'group' ? 4 : 2;
    const capacity = Number(options.capacity ?? maxCap ?? defaultCapacity);
    const duration = Number(options.duration ?? (mode === 'group' ? 20 : 15));
    return {
        done,
        mode,
        capacity: Number.isInteger(capacity) ? capacity : defaultCapacity,
        duration: Number.isInteger(duration) ? duration : (mode === 'group' ? 20 : 15),
        topic: sanitizeText(options.topic, 200),
    };
}

function isValidRoomOptions(options) {
    const validCapacity = options.mode === 'one'
        ? options.capacity === 2
        : options.capacity >= 3 && options.capacity <= 6;
    const validDuration = options.mode === 'one'
        ? [5, 15, 25].includes(options.duration)
        : [10, 20, 30].includes(options.duration);
    return validCapacity && validDuration;
}

function getAvailableRoom(namespace, options) {
    for (const roomName of publicGroupRooms(namespace)) {
        const metadata = roomMetadata.get(roomName);
        const roomSize = countRoom(namespace, roomName) || 0;
        if (metadata && metadata.mode === options.mode && metadata.capacity === options.capacity && metadata.duration === options.duration && roomSize < metadata.capacity) {
            return roomName;
        }
    }
    return null;
}

function countRoom(namespace,roomName){
    //console.log(namespace.adapter.rooms.get(roomName)?.size);
    return namespace.adapter.rooms.get(roomName)?.size ;
}

function getRoomUserEmails(roomName, namespace, callback) {
    const room = namespace.adapter.rooms.get(roomName);
    if (!room) {
        return callback([]);
    }

    const socketIds = Array.from(room); 
    const emailsToFetch = socketIds
        .map(socketId => namespace.sockets.get(socketId)?.email)
        .filter(Boolean)
        .map(email => normalizeEmail(email));

    if (emailsToFetch.length === 0) {
        return callback([]);
    }

    const uniqueEmails = [...new Set(emailsToFetch)];

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('DB 연결 오류:', err);
            return callback([]);
        }

        const query = 'SELECT user_email FROM users WHERE LOWER(user_email) IN (?)';
        connection.query(query, [uniqueEmails], (err, results) => {
            connection.release();
            if (err) {
                console.error('이메일 조회 중 오류 발생:', err);
                return callback([]);
            }

            callback(results.map(row => normalizeEmail(row.user_email)));
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
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return null;

    purgeExpiredSessions();

    // 기존 이메일 토큰 정리 (단일 세션 정책)
    for (const [token, value] of sessionTokens.entries()) {
        if (value?.email === normalizedEmail) {
            sessionTokens.delete(token);
        }
    }

    const token = crypto.randomBytes(24).toString('hex');
    sessionTokens.set(token, { email: normalizedEmail, issuedAt: Date.now() });
    return token;
}

function resolveSessionToken(token) {
    if (!token) return null;
    purgeExpiredSessions();
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

function requireSocketAuth(socket, done) {
    if (socket.email) return true;
    if (typeof done === 'function') {
        done({ success: false, error: 'authentication_required' });
    }
    return false;
}

function isSocketInRoom(socket, roomName, done) {
    if (!roomName || !socket.rooms.has(roomName)) {
        if (typeof done === 'function') {
            done({ success: false, error: 'unauthorized_room' });
        }
        return false;
    }
    return true;
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

    socket.on("enter_room", (roomName, MaxCap, optionsOrDone, maybeDone) => {
        const options = normalizeRoomOptions(MaxCap, optionsOrDone, maybeDone);
        const done = options.done;
        if (!requireSocketAuth(socket, done)) return;
        if (!isValidRoomOptions(options)) {
            done?.(null, 'invalid_room_options');
            return;
        }

        let roomToJoin = getAvailableRoom(oneOnoneChat, options);
        const isNewRoom = !roomToJoin;
        if (!roomToJoin) {
            roomToJoin = roomName || createRoomName();
            roomMetadata.set(roomToJoin, {
                mode: options.mode,
                capacity: options.capacity,
                duration: options.duration,
                topic: options.topic,
                createdAt: Date.now(),
            });
        }

        socket.join(roomToJoin);
        const metadata = roomMetadata.get(roomToJoin);
        const roomSize = countRoom(oneOnoneChat, roomToJoin);
        done?.(roomToJoin, isNewRoom ? "방 없음" : "방 있음", metadata);
        if (!isNewRoom) {
            oneOnoneChat.to(roomToJoin).emit("join", roomSize, metadata);
            oneOnoneChat.to(roomToJoin).emit("welcome", socket.nickname, roomSize, metadata);
        }
        oneOnoneChat.emit("room_change", publicGroupRooms(oneOnoneChat));
    });

    socket.on("certify_email", async (email, univName, done) => {
        const normalizedEmail = normalizeEmail(email);
        const universityName = sanitizeText(univName, 100);
        const ip = getSocketIp(socket);
        cleanupVerificationState();

        if (!normalizedEmail || !universityName || !isUniversityEmail(normalizedEmail, universityName)) {
            done({ success: false, error: '학교 이메일 도메인이 학교와 일치하지 않습니다.' });
            return;
        }

        const existingChallenge = verificationChallenges.get(normalizedEmail);
        const now = Date.now();
        if (existingChallenge && existingChallenge.requestedAt > now - VERIFICATION_RESEND_COOLDOWN_MS) {
            done({ success: false, error: '인증번호는 60초 후 다시 요청할 수 있습니다.' });
            return;
        }
        if (verificationRequestsByIp.get(ip) > now - VERIFICATION_RESEND_COOLDOWN_MS) {
            done({ success: false, error: '잠시 후 다시 시도해주세요.' });
            return;
        }

        const code = createVerificationCode();
        try {
            await sendVerificationEmail(normalizedEmail, code, universityName);
            verificationChallenges.set(normalizedEmail, {
                codeHash: hashVerificationCode(normalizedEmail, code),
                universityName,
                requestedAt: now,
                expiresAt: now + VERIFICATION_TTL_MS,
                attempts: 0,
            });
            verificationRequestsByIp.set(ip, now);
            done({ success: true });
        } catch (error) {
            console.error('[server] Resend email failed:', error.response?.data || error.message);
            done({ success: false, error: '인증메일 발송에 실패했습니다.' });
        }
    });

    socket.on("verify_code", (email, code, done) => {
        const normalizedEmail = normalizeEmail(email);
        const challenge = verificationChallenges.get(normalizedEmail);
        const submittedCode = typeof code === 'string' ? code.trim() : '';

        if (!challenge || challenge.expiresAt <= Date.now()) {
            verificationChallenges.delete(normalizedEmail);
            done({ success: false, error: '인증번호가 만료되었습니다.' });
            return;
        }
        if (!/^\d{6}$/.test(submittedCode)) {
            done({ success: false, error: '인증번호 형식이 올바르지 않습니다.' });
            return;
        }

        challenge.attempts += 1;
        const submittedHash = hashVerificationCode(normalizedEmail, submittedCode);
        const isValid = crypto.timingSafeEqual(
            Buffer.from(challenge.codeHash, 'hex'),
            Buffer.from(submittedHash, 'hex')
        );
        if (!isValid) {
            if (challenge.attempts >= VERIFICATION_MAX_ATTEMPTS) {
                verificationChallenges.delete(normalizedEmail);
            }
            done({ success: false, error: '인증번호가 유효하지 않습니다.' });
            return;
        }

        verificationChallenges.delete(normalizedEmail);
        verifiedEmails.set(normalizedEmail, Date.now());
        done({ success: true });
    });

    socket.on("isLogin",(email,done)=>{
        const normalizedEmail = normalizeEmail(email);
        if (socket.email && socket.email !== normalizedEmail) {
            done(false);
            return;
        }
        if(activeUsers[normalizedEmail]){
            done(true);
        }
        else{
            done(false);
        }
    })

    socket.on("Login", async (email, passwd, done) => {
        const normalizedEmail = normalizeEmail(email);
        const verified = await verifyUserPassword(normalizedEmail, passwd);
        if (!verified.success) {
            done({ success: false });
            return;
        }

        const token = issueSessionToken(normalizedEmail);
        bindAuthenticatedSocket(socket, normalizedEmail, token);
        socket.emit("session_bound", { email: normalizedEmail });
        console.log("로그인 성공!");
        done({ success: true, email: normalizedEmail, sessionToken: token });
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
        const normalizedEmail = normalizeEmail(email);
        const safeNickname = sanitizeNickname(nickname);
        cleanupVerificationState();

        if (!normalizedEmail || !verifiedEmails.has(normalizedEmail) || !passwd || passwd.length < 6 || !safeNickname) {
            done({ success: false, error: 'invalid payload' });
            return;
        }

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
                    [normalizedEmail, hashedPassword, safeNickname, true],
                    (err, result) => {
                        conn.release();
                        if (err) {
                            console.error("회원가입 중 오류 발생:", err);
                            done({ success: false, error: 'duplicate_or_db_error' });
                            return;
                        }
                        verifiedEmails.delete(normalizedEmail);
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

        socket.rooms.forEach((room) => {
            if (room === socket.id) return;

            const currentCount = countRoom(oneOnoneChat, room) || 0;
            if (currentCount <= 1) {
                socket.leave(room);
                return;
            }

            if (currentCount === 2) {
                socket.to(room).emit("bye", "상대방이 퇴장하였습니다.");
                socket.leave(room);
                setTimeout(async () => {
                    const sockets = await oneOnoneChat.in(room).fetchSockets();
                    sockets.forEach((s) => {
                        if (s.id !== socket.id) {
                            s.leave(room);
                            s.emit("room_closed", "방이 종료되었습니다.");
                        }
                    });
                }, 1000);
            } else {
                socket.to(room).emit("bye", socket.nickname, Math.max(currentCount - 1, 0));
                socket.leave(room);
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
        for (const roomName of roomMetadata.keys()) {
            if (!oneOnoneChat.adapter.rooms.has(roomName)) {
                roomMetadata.delete(roomName);
            }
        }
        oneOnoneChat.emit("room_change", publicGroupRooms(oneOnoneChat));
    });

    socket.on("new_message", (msg, room, done) => {
        if (!requireSocketAuth(socket, done) || !isSocketInRoom(socket, room, done)) return;

        const cleanMessage = sanitizeText(msg, 500);
        if (!cleanMessage) {
            done?.({ success: false, error: 'invalid_message' });
            return;
        }

        socket.to(room).emit("new_message", {
            nickname: sanitizeNickname(socket.nickname) || 'Anonymous',
            text: cleanMessage,
        });
        done?.({ success: true });
    });

    socket.on("new_note", (value, friend, maybeEmailOrDone, maybeDone) => {
        const done = typeof maybeEmailOrDone === 'function' ? maybeEmailOrDone : maybeDone;
        const senderEmail = normalizeEmail(socket.email);
        const cleanFriend = normalizeEmail(friend);
        const cleanValue = sanitizeText(value, 500);

        if (!requireSocketAuth(socket, done) || !senderEmail || !cleanFriend || !cleanValue) {
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
            connection.query(query, [senderEmail, cleanFriend, cleanValue], (error) => {
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
        const myEmail = normalizeEmail(socket.email);
        const cleanFriendEmail = normalizeEmail(friendEmail);

        if (!requireSocketAuth(socket, done) || !myEmail || !cleanFriendEmail) {
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
            [myEmail, cleanFriendEmail, cleanFriendEmail, myEmail],
            (error, result) => {
              connection.release();
              if (error) {
                console.log("메시지 가져오는 쿼리문 실행 중 오류발생.", error);
                                if (typeof done === 'function') done([]);
                return;
              }
              const messageContents = result.map(row => sanitizeText(row.message_content, 500));
                            if (typeof done === 'function') done(messageContents);
            }
          );
        });
      });

    socket.on("friendRequest", (room, done) => {
        if (!requireSocketAuth(socket, done) || !isSocketInRoom(socket, room, done)) return;

        getRoomUserEmails(room, oneOnoneChat, (emails) => {
            if (emails.length < 2) {
                if (typeof done === 'function') {
                    done({ success: false, error: '상대방 정보를 찾을 수 없습니다.' });
                }
                return;
            }

            const requesterEmail = normalizeEmail(socket.email);
            const friendEmail = emails.find((email) => normalizeEmail(email) !== requesterEmail);

            if (!friendEmail) {
                if (typeof done === 'function') {
                    done({ success: false, error: '상대방 정보를 찾을 수 없습니다.' });
                }
                return;
            }

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
        if (!requireSocketAuth(socket, done) || !isSocketInRoom(socket, roomName, done)) return;

        getRoomUserEmails(roomName, oneOnoneChat, (emails) => {
            if (emails.length < 2) {
                console.log("룸에 유저가 충분하지 않습니다.");
                if (typeof done === 'function') {
                    done({ success: false, error: '룸에 유저가 충분하지 않습니다.' });
                }
                return;
            }

            const requesterEmail = normalizeEmail(socket.email);
            const friendEmail = emails.find((email) => normalizeEmail(email) !== requesterEmail);

            if (!friendEmail) {
                if (typeof done === 'function') {
                    done({ success: false, error: '상대방 정보를 찾을 수 없습니다.' });
                }
                return;
            }

            areUsersAlreadyFriends(requesterEmail, friendEmail, (alreadyFriends) => {
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

                    connection.query(query, [requesterEmail, friendEmail], (err) => {
                        connection.release();
                        if (err) {
                            console.log("친구 추가 중 오류 발생", err);
                            if (typeof done === 'function') {
                                done({ success: false, error: '친구 추가 중 오류가 발생했습니다.' });
                            }
                            return;
                        }

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
        if (!requireSocketAuth(socket, callback)) return;

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
        if (!requireSocketAuth(socket, done)) return;

        const safeFriendName = sanitizeNickname(friendName);
        if (!safeFriendName) {
            if (typeof done === 'function') done([], null);
            return;
        }

        pool.getConnection((err, connection) => {
            if (err) {
                console.log("DB 연결 오류 FriendChat", err);
                if (typeof done === 'function') done([], null);
                return;
            }
            
            const queryEmail = 'SELECT user_email FROM users WHERE user_nickname = ?';
            connection.query(queryEmail, [safeFriendName], (error, results) => {
                if (error) {
                    console.log("이메일 조회 중 오류발생:", error);
                    connection.release();
                    if (typeof done === 'function') done([], null);
                    return;
                }
                
                if (results.length > 0) {
                    const friendEmail = normalizeEmail(results[0].user_email);
                    const queryMessages = `
                        SELECT message_content, sent_at, sender_email
                        FROM messages
                        WHERE (sender_email = ? AND receiver_email = ?)
                           OR (sender_email = ? AND receiver_email = ?)
                        ORDER BY sent_at ASC
                    `;
                    connection.query(queryMessages, [normalizeEmail(socket.email), friendEmail, friendEmail, normalizeEmail(socket.email)], (msgError, msgResults) => {
                        if (msgError) {
                            console.log("메시지 조회 중 오류 발생:", msgError);
                            connection.release();
                            if (typeof done === 'function') done([], null);
                            return;
                        }
                        
                        if (msgResults.length > 0) {
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
                    if (typeof done === 'function') done([], null);
                }
            });
        });
    });
    
    
    socket.on("nickname", (nickname) => {
        socket["nickname"] = nickname;
    });
});
