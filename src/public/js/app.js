//const GroupSocket = io("http://localhost:3001");  //1대1챗 백엔드 서버로 연결 설정
//const oneOnoneSocket = io("http://localhost:3000");  // 1대1 챗 서버
//let socket
let activeSocket = null;

const welcome = document.querySelector("#welcome");
const rnform = welcome.querySelector("#roomname");
const nickform = welcome.querySelector("#nickname");
const room = document.querySelector("#room");
//const Groupchat = document.querySelector("#Group");
const individual = document.querySelector("#oneOnone");
const GroupSelect = document.querySelector("#GroupSelect")
const sub = document.querySelector("#SubTitle");
const choose = document.querySelector("#choose");
const emailform = document.querySelector("#emailSubmit");
const emailButton = document.querySelector("#emailButton");
const verifyform = document.querySelector("#verifySubmit");
const verifyButton = document.querySelector("#verifyButton");
const waiting = document.querySelector("#waiting")



emailform.addEventListener("submit",handleEmail);
verifyform.addEventListener("submit",handleVerify);

function handleVerify(event){
    event.preventDefault();
    const emailInput = document.querySelector("#emailInput").value;
    const codeInput = document.querySelector("#codeInput").value;

    activeSocket.emit("verify_code", emailInput,codeInput,(response)=>{
        if (response.success) {
            // 인증 코드 검증이 성공했을 때만 다음 단계로 이동
            console.log("이메일 인증에 성공했습니다.");
            verifyform.hidden = true;
            nickform.hidden = false;
        } else {
            console.log("인증 실패:", response.error);
            alert("인증 코드가 유효하지 않습니다. 다시 시도해주세요.");
        }
    });
    
}

function handleEmail(event){
    event.preventDefault();
    const emailInput = emailform.querySelector('#emailInput').value;
    const univNameInput = "한국외국어대학교";

    activeSocket.emit("certify_email", emailInput,univNameInput,(response)=>{
        if (response.success) {
            console.log("인증 코드가 전송되었습니다.");
            emailform.hidden = true;
            verifyform.hidden = false;
        }
        else if(response.error.message || response.error.message.trim() === "인증 코드 전송 실패: 이미 완료된 요청입니다."){
            console.log("이미 인증이 끝난 이메일!");
            emailform.hidden = true;
            nickform.hidden = false;
        }else {
            console.log("인증 코드 전송 실패:", response.error.message);
            alert("인증 코드 전송에 실패했습니다. 다시 시도해주세요.");
        }
    });

}

let currentRoomName;
let Roomcap;

welcome.style.display = "none";
room.hidden = true;
emailform.hidden = true;
verifyform.hidden = true;
rnform.hidden = true;
nickform.hidden = true;
GroupSelect.hidden = false;
waiting.hidden = true;

//Groupchat.addEventListener("click", handleGroupchat);
individual.addEventListener("click", handleOneonOne);

function handleOneonOne(event){
    event.preventDefault();
    GroupSelect.hidden = true;
    choose.hidden = true;
    nickform.hidden = true;
    emailform.hidden = false;
    welcome.style.display =  "flex";
    sub.innerText = "1대1 랜덤 챗";
    Roomcap = 2;
    activeSocket = io("/oneonone")
    setupSocketListeners(); 
}


function handleGroupchat(event){
    event.preventDefault();
    GroupSelect.hidden = true;
    choose.hidden = true;
    nickform.hidden = true;
    emailform.hidden = false;
    welcome.style.display =  "flex";
    sub.innerText = "그룹 랜덤 챗";
    Roomcap = 30;
    activeSocket = io("/group")
    setupSocketListeners();
}

function addMessage(message, isOwnMessage = false) {
    const ul = room.querySelector("ul.message-container");
    const li = document.createElement("li");
    li.classList.add("message-container-item");

    // 현재 시간을 구하여 포맷
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    // 메시지 텍스트
    const messageBox = document.createElement("div");
    messageBox.classList.add("message");
    messageBox.classList.add(isOwnMessage ? "you" : "other");
    messageBox.innerText = message;

    // 시간 텍스트
    const messageTime = document.createElement("div");
    messageTime.classList.add("message-time");
    messageTime.innerText = time;

    // 메시지와 시간을 li에 추가
    li.appendChild(messageBox);
    li.appendChild(messageTime);

    ul.appendChild(li);
    ul.scrollTop = ul.scrollHeight;
}


function handleMessageSubmit(event) {
    event.preventDefault();
    const input = room.querySelector("#msg input");
    const value = input.value;
    activeSocket.emit("new_message", value, currentRoomName, () => {
        addMessage(`${value}`, true);
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
    welcome.style.display = "none";
    rnform.hidden = true;
    activeSocket.emit("enter_room",null, Roomcap,(roomName,RoomExist) => {
        if(RoomExist === "방 없음"){
            currentRoomName = roomName;
            waiting.hidden = false;
        }
        else{
            currentRoomName = roomName;
            showRoom();
        }
    });
}

nickform.addEventListener("submit", handleNicknameSubmit);

function setupSocketListeners() {
    activeSocket.on("welcome", (user, newCount) => {
        const h3 = room.querySelector("h3");
        h3.innerText = `방에 (${newCount})명 있음.`;
        addMessage(`${user} 방 입장!`);
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
        waiting.hidden = true;
        //currentRoomName = roomName;
        showRoom();
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
