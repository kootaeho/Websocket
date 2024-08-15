const socket = io();

const welcome = document.querySelector("#welcome")
const rnform = welcome.querySelector("#roomname")
const nickform = welcome.querySelector("#nickname")
const room = document.getElementById("room");


let i =1

room.hidden = true
rnform.hidden = true

let roomName;

function addMessage(message){
    const ul = room.querySelector("ul")
    const li = document.createElement("li")
    li.innerText = message;
    ul.appendChild(li);
}

function handleMessageSubmit(event){
    event.preventDefault();
    const input = room.querySelector("#msg input");
    const value = input.value;
    socket.emit("new_message", input.value,roomName, ()=>{
        addMessage(`You: ${value}`);
    });
    input.value = "";
}


function handleNicknameSubmit(event){
    event.preventDefault();
    const input = welcome.querySelector("#nickname input");
    socket.emit("nickname",input.value);
    showRoomenter();
}

function showRoom(){
    welcome.hidden = true;
    room.hidden = false;
    const h3 = room.querySelector("h3");
    h3.innerText = `Room ${roomName}`;
    const msgForm = room.querySelector("#msg");
    msgForm.addEventListener("submit", handleMessageSubmit);
}

function showRoomenter(){
    nickform.hidden = true;
    rnform.hidden = false;
    rnform.addEventListener("click", handleRoomsubmit);
}


function handleRoomsubmit(event){
    event.preventDefault();
    //const input = rnform.querySelector("input");
    //const nameForm = room.querySelector("#nickname");
    roomName = i+1
    socket.emit("enter_room", roomName, showRoom);
    //nameForm.addEventListener("submit", handleNicknameSubmit);
    //roomName = input.value;
    //input.value = "";
}

nickform.addEventListener("submit", handleNicknameSubmit);

socket.on("welcome",(user, newCount)=>{
    const h3 = room.querySelector("h3");
    h3.innerText = `Room ${roomName} (${newCount})`;
    addMessage(`${user} joined!`);
})

socket.on("bye", (user, newCount)=>{
    const h3 = room.querySelector("h3");
    h3.innerText = `Room ${roomName} (${newCount})`;
    addMessage(`${user} left!`);
})


socket.on("new_message", addMessage);

socket.on("join", (newCount)=>{
    const h3 = room.querySelector("h3");
    h3.innerText = `Room ${roomName} (${newCount})`;
})


socket.on("room_change", (rooms) => {
    const roomList = welcome.querySelector("ul");
    roomList.innerHTML = "";
    if(rooms.length === 0){
        return;
    }
    rooms.forEach(room =>{
        const li = document.createElement("li");
        li.innerText = room;
        roomList.append(li);
    });
});