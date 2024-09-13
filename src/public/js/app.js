//const GroupSocket = io("http://localhost:3001");  //1대1챗 백엔드 서버로 연결 설정
//const oneOnoneSocket = io("http://localhost:3000");  // 1대1 챗 서버
//let socket
let activeSocket = io("/oneonone");
//const path = require('path');

let email = null;
let passwd = null;
let nickname = null;

const welcome = document.querySelector("#welcome");
const rnform = document.querySelector("#roomname");
const nickform = document.querySelector("#nickname");
const room = document.querySelector("#room");
//const Groupchat = document.querySelector("#Group");
//const individual = document.querySelector("#oneOnone");
//const GroupSelect = document.querySelector("#GroupSelect")
const sub = document.querySelector("#SubTitle");
//const choose = document.querySelector("#choose");
const emailform = document.querySelector("#emailSubmit");
const LoginButton = document.querySelector("#LoginButton");
const verifyform = document.querySelector("#verifySubmit");
const verifyButton = document.querySelector("#verifyButton");
const waiting = document.querySelector("#waiting");
const LogIn = document.querySelector("#LogIn")
const leaveButton = document.querySelector("#leave");
const SignIn = document.querySelector("#SignIn");
const SiginButton = document.querySelector("#SiginButton");
const main = document.querySelector("#main");
const emailCodeButton = document.querySelector("#emailCodeButton");
const passwdSubmit = document.querySelector("#passwdSubmit");
const password = document.querySelector("#passwd");
const passwdButton = document.querySelector("#passwdButton");
const nicknameButton = document.querySelector("#nicknameButton");
const Logo = document.querySelector("#Logo");
const friendBox = document.querySelector("#friendBox");
const nick = document.querySelector("#nick")
const nickInput = document.getElementById('nickInput');
const FriendRequest = document.querySelector("#FriendRequest");
const FriendAccept = document.querySelector("#FriendAccept");



Logo.addEventListener("click",()=>{
    console.log("로고 눌림!");
})

LoginButton.addEventListener("click",handleLogin);
SiginButton.addEventListener("click",handleSignin);

function handleSignin(event){
    event.preventDefault();
    welcome.style.display = "none";
    SignIn.hidden = false;
    emailform.hidden = false;
    activeSocket.emit("clear_code","xogh1289@hufs.ac.kr",(response)=>{
        console.log("초기화 됨!");
    })
    emailCodeButton.addEventListener("click",(event)=>{
        event.preventDefault();
        handleEmail();
    })
}

function handleLogin(event){
    event.preventDefault();
    const emailInput = document.querySelector("#emailInput").value;
    const passwdInput = document.querySelector("#passwdInput").value;
    activeSocket.emit("Login", emailInput,passwdInput,(response)=>{
        if(response.success == true){
            handleMainPage();
        }
        else{
            alert("잘못된 이메일/패스워드!");
        }
    })
}

function handleMainPage(){
    welcome.style.display = "none";
    main.hidden = false;
    rnform.hidden = false;
    friendBox.hidden = false;
    rnform.addEventListener("click", handleRoomSubmit);
}

function handleVerify(event){
    event.preventDefault();
    const codeInput = document.querySelector("#codeInput").value;
    activeSocket.emit("verify_code", email,codeInput,(response)=>{
        if (response.success) {
            verifyform.hidden = true;
            passwdSubmit.hidden = false
            passwdButton.addEventListener("click",handlePasswd)
        } else {
            console.log("인증 실패:", response.error);
            alert("인증 코드가 유효하지 않습니다. 다시 시도해주세요.");
        }
    });
}

function handlePasswd(event){
    event.preventDefault();
    const passwdInput = document.querySelector("#passwd").value;
    handleNickname(passwdInput);
}

function handleNickname(passwdInput){
    const passwdInputs = passwdInput
    passwdSubmit.hidden = true
    nickform.hidden = false;
    nicknameButton.addEventListener("click",(event)=>{
        const nicknameinputs = document.querySelector("#nicknameInput").value;
        event.preventDefault();
        console.log(nicknameinputs);
        nickform.hidden = true;
        SignIn.hidden = true;
        welcome.style.display = "flex";
        LogIn.hidden = false;
        activeSocket.emit("adduser",email,passwdInputs,nicknameinputs,(response)=>{
            console.log(response)
        })
    });
}

function handleEmail(event){
    //event.preventDefault();
    email = document.querySelector('#emailVerify').value;
    const univNameInput = "한국외국어대학교";

    activeSocket.emit("certify_email", email,univNameInput,(response)=>{
        if (response.success) {
            console.log("인증 코드가 전송되었습니다.");
            emailform.hidden = true;
            verifyform.hidden = false;
            verifyButton.addEventListener("click",handleVerify);
        }   
        else if(response.error.message == "이미 완료된 요청입니다."){
            alert("이미 인증이 끝난 이메일!");
            //emailform.hidden = true;
            //nickform.hidden = false;
        }else {
            console.log("인증 코드 전송 실패:", response.error.message);
            alert("인증 코드 전송에 실패했습니다. 이메일을 확인해주세요.");
        }
    });
}

let currentRoomName;
let Roomcap;

SignIn.hidden = true;
welcome.style.display = "flex";
room.hidden = true;
emailform.hidden = true;
verifyform.hidden = true;
rnform.hidden = true;
nickform.hidden = true;
waiting.hidden = true;
passwdSubmit.hidden = true;
friendBox.hidden = true;
nick.hidden = true;
FriendAccept.hidden = true;

//Groupchat.addEventListener("click", handleGroupchat);
//individual.addEventListener("click", handleOneonOne);

function handleOneonOne(event){
    event.preventDefault();
    nickform.hidden = true;
    emailform.hidden = false;
    welcome.style.display =  "flex";
    sub.innerText = "1대1 랜덤 챗";
    Roomcap = 2;
    //setupSocketListeners(); 
}

/*
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
}*/

function addMessage(message, isOwnMessage = false) {
    //console.log("에드 메시지 호출됨!")
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
/*
function handleNicknameSubmit(event) {
    event.preventDefault();
    nickname = welcome.querySelector("#nickname input").value;
    activeSocket.emit("nickname", nickname.value);
    showRoomEnter();
}*/

function showRoom() {
    //setupSocketListeners();
    welcome.style.display = "none";
    room.hidden = false;
    //const h3 = room.querySelector("h3");
    //h3.innerText = `Room ${currentRoomName}`;
    const msgForm = room.querySelector("#msg");
    leaveButton.addEventListener("click", handleLeave);
    msgForm.addEventListener("submit", handleMessageSubmit);
    FriendRequest.addEventListener("click",handleFriendRequest);
}

function handleFriendRequest(){
    activeSocket.emit("friendRequest",currentRoomName,()=>{
        console.log("친구 요청 보냄!")
    })
}

function handleLeave(){
    rnform.hidden = false;
    //nickform.hidden = false;
    welcome.style.display =  "flex";
    room.hidden = true;
    console.log(currentRoomName);
    activeSocket.emit("leave_room", currentRoomName);
}

function showRoomEnter() {
    nickform.hidden = true;
    rnform.hidden = false;
    //rnform.removeEventListener("click", handleRoomSubmit);
    rnform.addEventListener("click", handleRoomSubmit);
}

function handleFriendAccept(){
    console.log("수락버튼 눌림!");
    activeSocket.emit("addFriend",currentRoomName);
}

function handleRoomSubmit(event) {
    //userCount += 1;
    event.preventDefault();
    rnform.hidden = true;
    nick.hidden = false;
    sub.innerText = "1대1 랜덤 챗";
    Roomcap = 2;
    nick.addEventListener('submit',(event)=>{
        event.preventDefault();
        nick.hidden = true;
        const nickn = nickInput.value;
        activeSocket.emit("nickname",nickn);
        activeSocket.emit("enter_room",null, Roomcap,(roomName,RoomExist) => {
            if(RoomExist === "방 없음"){
                currentRoomName = roomName;
                waiting.hidden = false;
                setupSocketListeners();
            }
            else{
                currentRoomName = roomName;
                setupSocketListeners();
                showRoom();
            }
        });
    })
}


function setupSocketListeners() {
    activeSocket.on("welcome", (user, newCount) => {
        const h3 = room.querySelector("h3");
        h3.innerText = `방에 (${newCount})명 있음.`;    
        addMessage(`매칭되었습니다! 서로 인사를 나눠보세요!`);
    });

    activeSocket.on("bye", (user, newCount) => {
        const h3 = room.querySelector("h3");
        h3.innerText = `방에 (${newCount})명 있음.`;
        addMessage(`${user} left!`);
    });

    activeSocket.on("new_message", (message) => {
        addMessage(message);
    });

    activeSocket.on("friendRequest",()=>{
        FriendAccept.hidden = false;
        FriendRequest.hidden = true;
        addMessage(`상대방이 친구요청을 보냈습니다!`);
        FriendAccept.addEventListener("click",handleFriendAccept);
    })

    activeSocket.on("join", (newCount) => {
        waiting.hidden = true;
        //currentRoomName = roomName;
        showRoom();
        const h3 = room.querySelector("h3");
        h3.innerText = `방에 (${newCount})명 있음.`;
    });

    activeSocket.on("FriendAdd",()=>{
        alert("친구가 추가되었습니다!");
    })

    activeSocket.on("room_change", (rooms) => {
        const roomList = welcome.querySelector("ul");
        if (rooms.length === 0) {
            return;
        }
    });
}