const socket = io();

const welcome = document.querySelector("#welcome")
const form = welcome.querySelector("form")

function handleRoomsubmit(event){
    event.preventDefault();
    const input = form.querySelector("input");
    socket.emit("room", {payload: input.value});
    input.value = "";
}

form.addEventListener("submit", handleRoomsubmit)
