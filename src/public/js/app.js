//const GroupSocket = io("http://localhost:3001");  //1대1챗 백엔드 서버로 연결 설정
//const oneOnoneSocket = io("http://localhost:3000");  // 1대1 챗 서버
//let socket
let activeSocket = null;

const welcome = document.querySelector("#welcome");
const rnform = welcome.querySelector("#roomname");
const nickform = welcome.querySelector("#nickname");
const room = document.getElementById("room");
const Groupchat = document.querySelector("#Group");
const individual = document.querySelector("#oneOnone");
const GroupSelect = document.querySelector("#GroupSelect")
const sub = document.querySelector("#SubTitle");
const choose = document.querySelector("choose");

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
    welcome.style.display =  "";
    sub.innerText = "1대1 랜덤 챗";
    nickform.hidden = false;
    Roomcap = 2;
    activeSocket = io("/oneonone")
    setupSocketListeners(); 
}


function handleGroupchat(event){
    event.preventDefault();
    GroupSelect.hidden = true;
    choose.hidden = true;
    sub.innerText = "그룹 랜덤 챗";
    nickform.hidden = false;
    welcome.style.display =  "";
    Roomcap = 30;
    activeSocket = io("/group")
    setupSocketListeners();
}

function addMessage(message, isOwnMessage = false) {
    const ul = room.querySelector("ul.message-container");
    const li = document.createElement("li");
    li.classList.add("message");
    li.classList.add(isOwnMessage ? "you" : "other");
    li.innerText = message;
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
        addMessage(`${user} joined!`);
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
        console.log("join 함수 도착!");
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
