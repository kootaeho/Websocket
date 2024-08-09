const socket = io();

const welcome = document.querySelector("#welcome")
const form = welcome.querySelector("form")

function handleRoomsubmit(event){
    event.preventDefault();
    const input = form.querySelector("input");
    socket.emit("enter_room", {payload: input.value},(response) => {
        console.log(response)
    });
    input.value = "";
}

form.addEventListener("submit", handleRoomsubmit)
