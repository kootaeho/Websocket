const socket = io();

const welcome = document.querySelector("#welcome")
const form = welcome.querySelector("form")
const room = document.getElementById("room");

room.hidden = true

let roomName;

function addMessage(message){
    const ul = chat.querySelector("ul")
    const li = document.createElement("li")
    innerText = message;
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
    const input = room.querySelector("#nickname input");
    socket.emit("nickname",input.value);
}

function showRoom(){
    welcome.hidden = true;
    room.hidden = false;
    const h3 = room.querySelector("h3");
    h3.innerText = `Room ${roomName}`;
    const msgForm = room.querySelector("#msg");
    const nameForm = room.querySelector("#nickname");
    msgForm.addEventListener("submit", handleMessageSubmit);
    nameForm.addEventListener("submit", handleNicknameSubmit);
}

function handleRoomsubmit(event){
    event.preventDefault();
    const input = form.querySelector("input");
    socket.emit("enter_room", {payload: input.value}, showRoom);
    roomName = input.value;
    input.value = "";
}

form.addEventListener("submit", handleRoomsubmit)

socket.on("welcome",()=>{
    addMessage("Someone joined!");
})

socket.on("bye", ()=>{
    addMessage("someone left!");
})


socket.on("new_message", addMessage);