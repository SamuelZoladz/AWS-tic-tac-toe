import os
import random
import string
import jwt
import requests
import boto3
from flask import Flask, request, jsonify
from flask_socketio import SocketIO, join_room, emit
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")
rooms = []
rooms_details = {}

region = os.getenv('AWS_REGION')
app_client_id = os.getenv('COGNITO_CLIENT_ID')
user_pool_id = os.getenv('COGNITO_POOL_ID')

cognito_client = boto3.client('cognito-idp', region_name=region)


def get_jwk(jwks_url):
    jwks = requests.get(jwks_url).json()
    return {key["kid"]: jwt.algorithms.RSAAlgorithm.from_jwk(key) for key in jwks['keys']}


jwks_url = f'https://cognito-idp.{region}.amazonaws.com/{user_pool_id}/.well-known/jwks.json'
jwks = get_jwk(jwks_url)


def validate_token(access_token):
    try:
        headers = jwt.get_unverified_header(access_token)
        key_id = headers['kid']
        public_key = jwks[key_id]
        decoded_token = jwt.decode(access_token, public_key, algorithms=['RS256'])
        return decoded_token
    except jwt.PyJWTError as error:
        logger.error(f"JWT decode error: {error}")
        return None


@app.route('/')
def hello_world():
    return 'Hello, World!'


@app.route('/signup', methods=['POST'])
def signup():
    data = request.get_json()
    username = data['username']
    password = data['password']
    email = data['email']

    logger.info(f"Received signup request for username: {username}")

    try:
        response = cognito_client.sign_up(
            ClientId=app_client_id,
            Username=username,
            Password=password,
            UserAttributes=[
                {
                    'Name': 'email',
                    'Value': email
                }
            ]
        )
        logger.info(f"Signup successful for username: {username}")
        return jsonify({"message": "Signup successful"})
    except Exception as e:
        logger.error(f"Error occurred during signup for username {username}: {str(e)}")
        return jsonify({"error": str(e)}), 400


@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data['username']
    password = data['password']

    logger.info(f"Received login request for username: {username}")

    try:
        response = cognito_client.initiate_auth(
            AuthFlow='USER_PASSWORD_AUTH',
            AuthParameters={
                'USERNAME': username,
                'PASSWORD': password
            },
            ClientId=app_client_id
        )
        logger.info(f"Login successful for username: {username}")
        return jsonify(response["AuthenticationResult"])
    except Exception as e:
        logger.error(f"Error occurred during login for username {username}: {str(e)}")
        return jsonify({"error": str(e)}), 400


@app.route('/refresh_token', methods=['POST'])
def refresh_token():
    data = request.get_json()
    refresh_token = data['refreshToken']
    logger.info("Received token refresh request")
    try:
        response = cognito_client.initiate_auth(
            AuthFlow='REFRESH_TOKEN_AUTH',
            AuthParameters={
                'REFRESH_TOKEN': refresh_token
            },
            ClientId=app_client_id
        )
        logger.info("Token refresh successful")
        return jsonify(response["AuthenticationResult"])
    except Exception as e:
        logger.error(f"Error occurred during token refresh: {str(e)}")
        return jsonify({"error": str(e)}), 400


@app.route('/logout', methods=['POST'])
def logout():
    print(request.headers)
    print(request)
    access_token = request.headers.get('Authorization')
    if access_token is None or validate_token(access_token) is None:
        return jsonify({"error": "Authentication required"}), 401
    try:
        cognito_client.global_sign_out(AccessToken=access_token)
        logger.info("Logout successful")
        return jsonify({"message": "Logged out successfully"})
    except Exception as e:
        logger.error(f"Error occurred during logout: {str(e)}")
        return jsonify({"error": str(e)}), 400


@socketio.on('join')
def on_join(data):
    access_token = data['accessToken']
    if not access_token or validate_token(access_token) is None:
        emit('error', {'message': 'Authentication required'})
        return
    client_id = data['clientId']
    data = data['data']
    username = data['username']

    logger.info(f"User {username} with client ID {client_id} joining the room")

    room = find_available_room_and_join(client_id)
    join_room(room)
    if rooms_details[room]["clients"][0] == client_id:
        symbol = 'o'
        rooms_details[room]["turn"] = 'o'
        rooms_details[room]["table"] = [''] * 9
    else:
        symbol = 'x'
    emit('joinInfo', {'roomId': room, 'symbol': symbol, 'clientId': client_id})


@socketio.on('makeMove')
def moveRequest(data):
    access_token = data['accessToken']
    if not access_token or validate_token(access_token) is None:
        emit('error', {'message': 'Authentication required'})
        return
    client_id = data['clientId']
    data = data['data']
    roomId = data['roomId']
    symbol = data['symbol']
    cellId = data['cellId']
    if rooms_details[roomId]["turn"] == symbol and len(rooms_details[roomId]["clients"]) == 2:
        if symbol == 'x':
            rooms_details[roomId]["turn"] = 'o'
        else:
            rooms_details[roomId]["turn"] = 'x'
        rooms_details[roomId]["table"][int(cellId[4:])] = symbol
        emit('move', {'roomId': roomId, 'symbol': symbol, 'cellId': cellId})
        if is_someone_winning(rooms_details[roomId]["table"]):
            rooms_details[roomId]["turn"] = ''
            emit('win', {'clientId': client_id})
            emit('lost', {'clientId': next(x for x in rooms_details[roomId]["clients"] if x != client_id)})


def find_available_room_and_join(client_id):
    if rooms != [] and len(rooms_details[rooms[-1]]["clients"]) < 2:
        room_name = rooms[-1]
        rooms_details[room_name]["clients"].append(client_id)
    else:
        room_name = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
        rooms.append(room_name)
        rooms_details[room_name] = {"clients": [client_id]}
    return room_name


def is_someone_winning(table):
    for i in range(0, 9, 3):
        if table[i] == table[i + 1] == table[i + 2] != '':
            return True

    for i in range(3):
        if table[i] == table[i + 3] == table[i + 6] != '':
            return True

    if table[0] == table[4] == table[8] != '' or table[2] == table[4] == table[6] != '':
        return True

    return False


if __name__ == '__main__':
    port = int(os.getenv('BACKEND_PORT', 5000))
    socketio.run(app, port=port, host='0.0.0.0', allow_unsafe_werkzeug=True)
