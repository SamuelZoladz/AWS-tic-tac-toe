const port = process.env.FRONTEND_PORT || 80;

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const socketIoClient = require('socket.io-client');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const API_URL = 'http://' + process.env.BACKEND_SERVICE_NAME + ':' + process.env.BACKEND_PORT;
const externalWsUrl = API_URL;
const externalWs = socketIoClient(externalWsUrl);

app.use(express.static('public'));
app.use(bodyParser.json());

app.post('/signup', async (req, res) => {
    try {
        const response = await axios.post(`${API_URL}/signup`, req.body);
        res.json(response.data);
        console.log('User signed up:', req.body.username);
    } catch (error) {
        res.status(500).send('Error during signup');
        console.error('Error during signup:', error.message);
    }
});

app.post('/login', async (req, res) => {
    try {
        const response = await axios.post(`${API_URL}/login`, req.body);
        res.json(response.data);
        console.log('User logged in:', req.body.username);
    } catch (error) {
        res.status(500).send('Error during login');
        console.error('Error during login:', error.message);
    }
});

app.post('/refresh_token', async (req, res) => {
    try {
        const response = await axios.post(`${API_URL}/refresh_token`, req.body);
        res.json(response.data);
    } catch (error) {
        res.status(500).send('Error during refreshing token');
        console.error('Error during refreshing token:', error.message);
    }
});

app.post('/logout', async (req, res) => {
    try {
        console.log(req.headers);
        const response = await axios.post(`${API_URL}/logout`, req.body, {
                            headers: req.headers
                          });
        res.json(response.data);
    } catch (error) {
        res.status(500).send('Error during logout');
        console.error('Error during logout:', error.message);
    }
});


io.on('connection', (clientSocket) => {
    const clientId = clientSocket.id;
    clientSocket.join(clientId);
    console.log('Client connected:', clientId);

    clientSocket.on('disconnect', () => {
        console.log('Client disconnected:', clientId);
    });

    clientSocket.on('join', (data) => {
        console.log('Joining room:', data.username, data.accessToken);
        externalWs.emit('join', { 'data': data, 'clientId': clientSocket.id, 'accessToken': data.accessToken });
    });

    clientSocket.on('makeMove', (data) => {
        console.log('Making move:', data);
        externalWs.emit('makeMove', { 'data': data, 'clientId': clientSocket.id, 'accessToken': data.accessToken });
    });
});

externalWs.on('connect', () => {
    console.log('External WebSocket server connected');
});

externalWs.on('joinInfo', (data) => {
    console.log('Join info received:', data);
    io.to(data.clientId).emit('joinInfo', data);
});

externalWs.on('move', (data) => {
    console.log('Move received:', data);
    io.emit('move', data);
});

externalWs.on('win', (data) => {
    console.log('Win received:', data);
    io.to(data.clientId).emit('win');
});

externalWs.on('lost', (data) => {
    console.log('Lost received:', data);
    io.to(data.clientId).emit('lost');
});

server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    console.log(`Server connects to ${externalWsUrl} backend`);
});
