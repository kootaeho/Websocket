const socket = io();

const welcome = document.querySelector("#welcome");
const rnform = welcome.querySelector("#roomname");
const nickform = welcome.querySelector("#nickname");
const room = document.getElementById("room");

let currentRoomName;

room.hidden = true;
rnform.hidden = true;

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
    socket.emit("new_message", value, currentRoomName, () => {
        addMessage(`You: ${value}`, true);
    });
    input.value = "";
}
function handleNicknameSubmit(event) {
    event.preventDefault();
    const input = welcome.querySelector("#nickname input");
    socket.emit("nickname", input.value);
    showRoomEnter();
}

function showRoom() {
    welcome.hidden = true;
    room.hidden = false;
    //const h3 = room.querySelector("h3");
    //h3.innerText = `Room ${currentRoomName}`;
    const msgForm = room.querySelector("#msg");
    msgForm.addEventListener("submit", handleMessageSubmit);
}

function showRoomEnter() {
    nickform.hidden = true;
    rnform.hidden = false;
    rnform.removeEventListener("click", handleRoomSubmit);
    rnform.addEventListener("click", handleRoomSubmit);
}

function handleRoomSubmit(event) {
    event.preventDefault();
    rnform.hidden = true;
    socket.emit("enter_room", null, (roomName) => {
        currentRoomName = roomName;
        showRoom();
    });
}

nickform.addEventListener("submit", handleNicknameSubmit);

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
    roomList.innerHTML = "";
    if (rooms.length === 0) {
        return;
    }
    /*rooms.forEach((room) => {
        const li = document.createElement("li");
        li.innerText = room;
        roomList.append(li);
    });*/
});
