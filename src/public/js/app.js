//const GroupSocket = io("http://localhost:3001");  //1대1챗 백엔드 서버로 연결 설정
//const oneOnoneSocket = io("http://localhost:3000");  // 1대1 챗 서버
//let socket
let activeSocket = null;

const welcome = document.querySelector("#welcome");
const rnform = welcome.querySelector("#roomname");
const nickform = welcome.querySelector("#nickname");
const room = document.querySelector("#room");
const Groupchat = document.querySelector("#Group");
const individual = document.querySelector("#oneOnone");
const GroupSelect = document.querySelector("#GroupSelect")
const sub = document.querySelector("#SubTitle");
const choose = document.querySelector("#choose");

let currentRoomName;
let Roomcap;

welcome.style.display = "none";
room.hidden = true;
rnform.hidden = true;
nickform.hidden = true;
GroupSelect.hidden = false;

Groupchat.addEventListener("click", handleGroupchat);
individual.addEventListener("click", handleOneonOne);

function handleOneonOne(event){
    event.preventDefault();
    GroupSelect.hidden = true;
    choose.hidden = true;
    nickform.hidden = false;
    welcome.style.display =  "flex";
    sub.innerText = "1대1 랜덤 챗";
    Roomcap = 2;
    activeSocket = io("/oneonone")
    setupSocketListeners(); 
}


function handleGroupchat(event){
    event.preventDefault();
    GroupSelect.hidden = true;
    choose.hidden = true;
    nickform.hidden = false;
    welcome.style.display =  "flex";
    sub.innerText = "그룹 랜덤 챗";
    Roomcap = 30;
    activeSocket = io("/group")
    setupSocketListeners();
}

function addMessage(message, isOwnMessage = false) {
    const ul = room.querySelector("ul.message-container");
    const li = document.createElement("li");
    li.classList.add("message-container-item");

    // 현재 시간을 구하여 포맷
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // 메시지 텍스트
    const messageBox = document.createElement("div");
    messageBox.classList.add("message");
    messageBox.classList.add(isOwnMessage ? "you" : "other");
    messageBox.innerText = message;

    // 시간 텍스트
    const messageTime = document.createElement("div");
    messageTime.classList.add("message-time");
    messageTime.innerText = time;

    // 메시지와 시간을 li에 추가
    li.appendChild(isOwnMessage ? messageTime : messageBox);
    li.appendChild(isOwnMessage ? messageBox : messageTime);

    ul.appendChild(li);
    ul.scrollTop = ul.scrollHeight;
}

function handleMessageSubmit(event) {
    event.preventDefault();
    const input = room.querySelector("#msg input");
    const value = input.value;
    activeSocket.emit("new_message", value, currentRoomName, () => {
        addMessage(`You: ${value}`, true);
    });
    input.value = "";
}
function handleNicknameSubmit(event) {
    event.preventDefault();
    const input = welcome.querySelector("#nickname input");
    activeSocket.emit("nickname", input.value);
    showRoomEnter();
}

function showRoom() {
    welcome.style.display = "none";
    room.hidden = false;
    //const h3 = room.querySelector("h3");
    //h3.innerText = `Room ${currentRoomName}`;
    const msgForm = room.querySelector("#msg");
    msgForm.addEventListener("submit", handleMessageSubmit);
}

function showRoomEnter() {
    nickform.hidden = true;
    rnform.hidden = false;
    //rnform.removeEventListener("click", handleRoomSubmit);
    rnform.addEventListener("click", handleRoomSubmit);
}

function handleRoomSubmit(event) {
    event.preventDefault();
    welcome.style.display = "none";
    rnform.hidden = true;
    activeSocket.emit("enter_room",null, Roomcap,(roomName) => {
        currentRoomName = roomName;
        showRoom();
    });
}

nickform.addEventListener("submit", handleNicknameSubmit);

function setupSocketListeners() {
    activeSocket.on("welcome", (user, newCount) => {
        const h3 = room.querySelector("h3");
        h3.innerText = `방에 (${newCount})명 있음.`;
        addMessage(`${user} 방 입장!`);
    });

    activeSocket.on("bye", (user, newCount) => {
        const h3 = room.querySelector("h3");
        h3.innerText = `방에 (${newCount})명 있음.`;
        addMessage(`${user} left!`);
    });

    activeSocket.on("new_message", (message) => {
        addMessage(message);
    });

    activeSocket.on("join", (newCount) => {
        const h3 = room.querySelector("h3");
        h3.innerText = `방에 (${newCount})명 있음.`;
    });

    activeSocket.on("room_change", (rooms) => {
        const roomList = welcome.querySelector("ul");
        if (rooms.length === 0) {
            return;
        }
    });
}
