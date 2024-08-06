const socket = new WebSocket(`ws://${window.location.host}`);

socket.addEventListener("open", () =>{
    console.log("Connected to Server!")
    socket.send("Hello from browser")
});

socket.addEventListener("message", (message)=>{
    console.log(message)
});

socket.addEventListener("close", ()=>{
    console.log("Disconnected from server")
});

