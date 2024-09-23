let activeSocket = io("/oneonone");

let email = null;
let passwd = null;
let nickname = null;

const welcome = document.querySelector("#welcome");
const rnform = document.querySelector("#roomname");
const nickform = document.querySelector("#nickname");
const room = document.querySelector("#room");
const sub = document.querySelector("#SubTitle");
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
const rnformButton = document.querySelector('form#roomname button');

Logo.addEventListener("click", () => {
    console.log("로고 눌림!");
})

LoginButton.addEventListener("click", handleLogin);
SiginButton.addEventListener("click", handleSignin);

function handleSignin(event) {
    event.preventDefault();
    welcome.style.display = "none";
    SignIn.hidden = false;
    emailform.hidden = false;
    emailCodeButton.addEventListener("click", (event) => {
        event.preventDefault();
        handleEmail();
    })
}

function handleLogin(event) {
    event.preventDefault();
    const emailInput = document.querySelector("#emailInput").value;
    email = emailInput;
    const passwdInput = document.querySelector("#passwdInput").value;
    activeSocket.emit("Login", emailInput, passwdInput, (response) => {
        if (response.success == true) {
            handleMainPage();
        } else {
            alert("잘못된 이메일/패스워드!");
        }
    })
}

function handleMainPage() {
    welcome.style.display = "none";
    main.hidden = false;
    rnform.hidden = false;
    friendBox.hidden = false;
    // 친구 목록을 동적으로 추가하는 부분
    activeSocket.emit("ShowFriend", (friendsList) => {
        const friends = friendsList;
        friendBox.innerHTML = "";
        friends.forEach(friend => {
            const friendCard = document.createElement('div');
            friendCard.classList.add('friend-card');
    
            const friendInfo = document.createElement('div');
            friendInfo.classList.add('friend-info');
    
            const friendName = document.createElement('h4');
            friendName.classList.add('friend-name');
            friendName.textContent = friend;
    
            const chatButton = document.createElement('button');
            chatButton.classList.add('chat-button');
            chatButton.textContent = '채팅';
            chatButton.setAttribute('data-friend', friend);
    
            friendInfo.appendChild(friendName);
            friendCard.appendChild(friendInfo);
            friendCard.appendChild(chatButton);
    
            friendBox.appendChild(friendCard);

            chatButton.addEventListener('click', (event) => {
                const friendName = event.target.getAttribute('data-friend');
                handle_friendChat(friendName);
            });
        });
    });
    rnformButton.addEventListener("click", handleRoomSubmit);
}

function handle_friendChat(friendName){
    console.log(friendName);
}


function handleVerify(event) {
    event.preventDefault();
    const codeInput = document.querySelector("#codeInput").value;
    activeSocket.emit("verify_code", email, codeInput, (response) => {
        if (response.success) {
            verifyform.hidden = true;
            passwdSubmit.hidden = false
            passwdButton.addEventListener("click", handlePasswd)
        } else {
            console.log("인증 실패:", response.error);
            alert("인증 코드가 유효하지 않습니다. 다시 시도해주세요.");
        }
    });
}

function handlePasswd(event) {
    event.preventDefault();
    const passwdInput = document.querySelector("#passwd").value;
    handleNickname(passwdInput);
}

function handleNickname(passwdInput) {
    const passwdInputs = passwdInput
    passwdSubmit.hidden = true
    nickform.hidden = false;
    nicknameButton.addEventListener("click", (event) => {
        const nicknameinputs = document.querySelector("#nicknameInput").value;
        event.preventDefault();
        console.log(nicknameinputs);
        nickform.hidden = true;
        SignIn.hidden = true;
        welcome.style.display = "flex";
        LogIn.hidden = false;
        activeSocket.emit("adduser", email, passwdInputs, nicknameinputs, (response) => {
            console.log(response)
        })
    });
}

function handleEmail(event) {
    email = document.querySelector('#emailVerify').value;
    const univNameInput = "한국외국어대학교";

    activeSocket.emit("certify_email", email, univNameInput, (response) => {
        console.log(response);
        if (response.success) {
            console.log("인증 코드가 전송되었습니다.");
            emailform.hidden = true;
            verifyform.hidden = false;
            verifyButton.addEventListener("click", handleVerify);
        } else if (response.error.message == "이미 완료된 요청입니다.") {
            alert("이미 인증이 끝난 이메일!");
        } else {
            console.log("인증 코드 전송 실패:", response.error.message);
            alert("인증 코드 전송에 실패했습니다. 이메일을 확인해주세요.");
        }
    });
}

let currentRoomName;
let Roomcap;

SignIn.hidden = true;
welcome.style.display = "flex";
room.style.display = "none";
emailform.hidden = true;
verifyform.hidden = true;
rnform.hidden = true;
nickform.hidden = true;
waiting.hidden = true;
passwdSubmit.hidden = true;
friendBox.hidden = true;
nick.hidden = true;
FriendAccept.hidden = true;

function addMessage(message, isOwnMessage = false) {
    const ul = room.querySelector("ul.message-container");
    const li = document.createElement("li");
    li.classList.add("message-container-item");

    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const messageBox = document.createElement("div");
    messageBox.classList.add("message");
    messageBox.classList.add(isOwnMessage ? "you" : "other");
    messageBox.innerText = message;

    const messageTime = document.createElement("div");
    messageTime.classList.add("message-time");
    messageTime.innerText = time;

    // 상대방 메시지일 경우 위치 조정
    if (!isOwnMessage) {
        messageTime.style.alignSelf = "flex-start"; // 시간 텍스트를 왼쪽으로 정렬
        messageTime.style.marginLeft = "10px"; // 약간의 왼쪽 마진 추가
    }

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

function handleFriendRequest() {
    activeSocket.emit("friendRequest", currentRoomName, () => {
        console.log("친구 요청 보냄!")
    })
}

function handleLeave() {
    rnform.hidden = true;
    welcome.style.display = "flex";
    room.style.display = "none";
    console.log(currentRoomName);
    activeSocket.emit("leave_room", currentRoomName);
}

function showRoom() {
    welcome.style.display = "none";
    room.style.display = "flex";
    const msgForm = room.querySelector("#msg");
    leaveButton.addEventListener("click", handleLeave);
    msgForm.addEventListener("submit", handleMessageSubmit);
    FriendRequest.addEventListener("click", handleFriendRequest);
}

function handleFriendAccept() {
    console.log("수락버튼 눌림!");
    activeSocket.emit("addFriend", currentRoomName);
}

function handleRoomSubmit(event) {
    event.preventDefault();
    rnform.hidden = true;
    nick.hidden = false;
    sub.innerText = "1대1 랜덤 챗";
    Roomcap = 2;
    nick.addEventListener('submit', (event) => {
        event.preventDefault();
        nick.hidden = true;
        const nickn = nickInput.value;
        activeSocket.emit("nickname", nickn);
        activeSocket.emit("enter_room", null, Roomcap, (roomName, RoomExist) => {
            if (RoomExist === "방 없음") {
                currentRoomName = roomName;
                waiting.hidden = false;
                setupSocketListeners();
            } else {
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

    activeSocket.on("friendRequest", () => {
        FriendAccept.hidden = false;
        FriendRequest.hidden = true;
        addMessage(`상대방이 친구요청을 보냈습니다!`);
        FriendAccept.addEventListener("click", handleFriendAccept);
    })

    activeSocket.on("join", (newCount) => {
        waiting.hidden = true;
        showRoom();
        const h3 = room.querySelector("h3");
        h3.innerText = `방에 (${newCount})명 있음.`;
    });

    activeSocket.on("FriendAdd", () => {
        alert("친구가 추가되었습니다!");
    })

    activeSocket.on("room_change", (rooms) => {
        const roomList = welcome.querySelector("ul");
        if (rooms.length === 0) {
            return;
        }
    });
}
