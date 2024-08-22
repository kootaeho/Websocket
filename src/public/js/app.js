const GroupSocket = io("http://localhost:3001");  //1대1챗 백엔드 서버로 연결 설정
const oneOnoneSocket = io("http://localhost:3000");  // 1대1 챗 서버
//let socket
let activeSocket = null;

const welcome = document.querySelector("#welcome");
const rnform = welcome.querySelector("#roomname");
const nickform = welcome.querySelector("#nickname");
const room = document.getElementById("room");
const Groupchat = document.querySelector("#Group");
const individual = document.querySelector("#oneOnone");
const GroupSelect = document.querySelector("#GroupSelect")

let currentRoomName;
let Roomcap;

room.hidden = true; 
rnform.hidden = true;
nickform.hidden = true;
GroupSelect.hidden = false;

Groupchat.addEventListener("click", handleGroupchat);
individual.addEventListener("click", handleOneonOne);

function handleOneonOne(event){
    event.preventDefault();
    GroupSelect.hidden = true;
    nickform.hidden = false;
    Roomcap = 2;
    activeSocket = oneOnoneSocket;
    handleNicknameSubmit();
}


function handleGroupchat(event){
    event.preventDefault();
    GroupSelect.hidden = true;
    nickform.hidden = false;
    Roomcap = 30;
    activeSocket = GroupSocket;
    handleNicknameSubmit();
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
    welcome.hidden = true;
    room.hidden = false;
    console.log("룸 보여주기 호출됨!")
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
        console.log("콜백 실행됨!")
        showRoom();
    });
}

nickform.addEventListener("submit", handleNicknameSubmit);

// 이벤트 리스너를 각각의 소켓에 연결
[GroupSocket, oneOnoneSocket].forEach(socket => {
    socket.on("welcome", (user, newCount) => {
        const h3 = room.querySelector("h3");
        h3.innerText = `방에 (${newCount})명 있음.`;
        addMessage(`${user} joined!`);
    });

    socket.on("bye", (user, newCount) => {
        const h3 = room.querySelector("h3");
        h3.innerText = `방에 (${newCount})명 있음.`;
        addMessage(`${user} left!`);
    });

    socket.on("new_message", addMessage);

    socket.on("join", (newCount) => {
        const h3 = room.querySelector("h3");
        h3.innerText = `방에 (${newCount})명 있음.`;
    });

    socket.on("room_change", (rooms) => {
        const roomList = welcome.querySelector("ul");
        //roomList.innerHTML = "";
        if (rooms.length === 0) {
            return;
        }
    });
});