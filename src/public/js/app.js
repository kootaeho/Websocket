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


function showRoom(){
    welcome.hidden = true;
    room.hidden = false;
    const h3 = room.querySelector("h3");
    h3.innerText = `Room ${roomName}`;
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