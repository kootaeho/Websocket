const socket = new WebSocket(`ws://${window.location.host}`);
const messageList = document.querySelector("ul");
const nicknameForm = document.querySelector("#nickname");
const messageForm = document.querySelector("#msgchat");


socket.addEventListener("open", () =>{
    console.log("Connected to Server!")
    socket.send("Hello from browser")
});

socket.addEventListener("message", (message)=>{
    const li = document.createElement("li")
    li.innerText = message.data;
    messageList.append(li);

});

socket.addEventListener("close", ()=>{
    console.log("Disconnected from server")
});

function handleSubmit(event){
    event.preventDefault();
    const input = messageForm.querySelector("input");
    socket.send(input.value)
    input.value = "";
}

function handleNickSubmit(event){
    event.preventDefault();
    const input = nicknameForm.querySelector("input");
    socket.send({
        type:"nickname",
        patload:input.value,
    });
}


messageForm.addEventListener("submit", handleSubmit);
nicknameForm.addEventListener("submit", handleNickSubmit);
