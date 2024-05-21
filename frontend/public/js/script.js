document.addEventListener('DOMContentLoaded', () => {
    const boardElement = document.querySelector('.board');
    for (let i = 0; i < 9; i++) {
        let cell = document.createElement('div');
        cell.id = `cell${i}`;
        cell.className = 'cell';
        cell.onclick = () => handleClick(cell);
        boardElement.appendChild(cell);
    }
    
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');

    loginForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        handleLogin({ username, password });
    });

    signupForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const username = document.getElementById('signup-username').value;
        const password = document.getElementById('signup-password').value;
        const email = document.getElementById('signup-email').value;
        handleSignup({ username, password, email });
    });
});

var socket = io.connect();
let loggedInUsername;
let roomId;
let symbol;

function connectToSocket(username) {
    const accessToken = localStorage.getItem('accessToken');  // Retrieve the access token
    if (username && accessToken) {
        socket.emit('join', { username: username, accessToken: accessToken });  // Include the accessToken
        updateUsernameDisplay(username);
    } else {
        alert("Login and a valid access token are required!");
    }
}

socket.on('connect', function() {
    if (loggedInUsername) {
        connectToSocket(loggedInUsername);
    }
});

socket.on('message', function(data) {
    console.log(data);
});

socket.on('joinInfo', function(data) {
    roomId = data.roomId;
    symbol = data.symbol;
    updateRoomIdDisplay(roomId);
});

socket.on('move', function(data) {
    if(data.roomId === roomId) {
        document.getElementById(data.cellId).innerText = data.symbol;
    }
});

socket.on('win', function() {
    updateGameResult("Wygrana");
});

socket.on('lost', function() {
    updateGameResult("Przegrana");
});

document.getElementById('logout-button').addEventListener('click', function() {
    axios.post('/logout', {}, {
        headers: { Authorization: localStorage.getItem('accessToken') }
    })
    .then(response => {
        alert('Logged out successfully!');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/';
    })
    .catch(error => {
        alert('Logout failed: ' + error.response.data.error);
    });
});

function handleClick(cell) {
    const accessToken = localStorage.getItem('accessToken');
    if(cell.innerText) return;
    if (accessToken) {
        socket.emit('makeMove', {
            roomId: roomId, 
            symbol: symbol, 
            cellId: cell.id, 
            accessToken: accessToken
        });
    } else {
        alert("Valid access token is required to make a move!");
    }
}

function updateRoomIdDisplay(roomId) {
    document.getElementById('room-id').innerText = 'Room ID: ' + roomId;
}

function updateUsernameDisplay(username) {
    document.getElementById('username').innerText = 'Username: ' + username;
}

function updateGameResult(result) {
    const resultDisplay = document.getElementById('game-result');
    resultDisplay.innerText = result;
    resultDisplay.style.visibility = 'visible';
}

function handleLogin(credentials) {
    axios.post('/login', credentials)
        .then(response => {
            localStorage.setItem('accessToken', response.data.AccessToken);
            localStorage.setItem('refreshToken', response.data.RefreshToken);
            refreshTokenFun();
            loggedInUsername = credentials.username;
            alert('Login successful!');
            connectToSocket(loggedInUsername);
        })
        .catch(error => {
            alert('Login failed: ' + error.message);
        });
}

function handleSignup(credentials) {
    axios.post('/signup', credentials)
        .then(response => {
            alert('Signup successful, please login!');
        })
        .catch(error => {
            alert('Signup failed: ' + error.message);
        });
}

function refreshTokenFun() {
    const refreshToken = localStorage.getItem('refreshToken');
    axios.post('/refresh_token', { refreshToken: refreshToken })
        .then(response => {
            console.log('Access token refreshed!');
            console.log(response.data);
            localStorage.setItem('accessToken', response.data.AccessToken);
            setTimeout(refreshTokenFun, (response.data.ExpiresIn - 280) * 1000);
        })
        .catch(error => {
            alert('Failed to refresh access token: ' + error.message);
        });
}