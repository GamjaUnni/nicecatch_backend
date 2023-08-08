const express = require("express");
const app = express();
const http = require("http");
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();

/**
 * WebSocket은 사용자와 서버간에 양방향 연결을 하는 HTML5 프로토콜을 말한다.
 * WebSocket API를 통해 서버로 메시지를 보내고 요청 없이 응답을 받아올 수 있다.
 * 이런 특성을 통해 실시간 어플리케이션 작성에 효과적이다.(채팅, 화상통화 등)
 */
const { Server } = require("socket.io");

app.use(cors());

const server = http.createServer(app);
const { SERVER_HOST, SERVER_PORT, CLIENT_PORT } = process.env;
const io = new Server(server, {
    cors: {
        origin: `http://${SERVER_HOST}:${CLIENT_PORT}`,
        // origin: "http://localhost:3000",
        // origin: `*`,
        methods: ["GET", "POST"],
        credentionals: true,
    },
});

// 임시 방 유저 정보 받기
const niceCatchRooms = {};
const ROOM_SIZE = 8; // 방마다 최대 크기
/**
 * 클라이언트(여기선 React에 접근한 사용자)가 우리 서버의 소켓에 접근하면 connection 이벤트가 발생한다.
 * 커넥션 이벤트가 발생하면 socket 객체를 전달 받는데, 해당 객체는 클라이언트별 개별 interacting을 위한 기본 객체다.
 * io: 전체 연결된 전체 클라이언트와의 interacting 객체
 * socket: 이벤트 핸들러의 socket은 개별 클라이언트의 interacting 객체
 * interacting: 상호 작용
 */
io.on("connection", (socket) => {
    console.log(`User Connected: ${socket.id}`);

    /**
     * on메소드
     * on(event name, function)
     * event name: string; 첫번째 파라미터는 이벤트명이다 클라이언트가 메시지 송신시 지정한 이벤트 명
     * function: 이벤트 핸들러 클라이언트가 송신한 메시지가 전달됨.
     *
     * io.emit : 접속된 모든 클라이언트에게 메시지를 전달함.
     * socket.emit: 메시지를 전송한 클라이언트에게만 메시지를 전달함.
     * socket.broadcast.emit: 메시지를 전송한 클라이언트를 제외한 모든 클라이언트에게 메시지를 전송
     * io.to(id).emit: 특정 클라이언트에게만 메시지를 전송함.
     */
    socket.on("join_room", (data) => {
        const { username, room } = data;
        console.log(
            `User with ID: ${socket.id} joined room: ${room}, username: ${username}`
        );
        console.log(niceCatchRooms[room]);

        // 방이 꽉찬 경우
        if (niceCatchRooms[room]?.length > ROOM_SIZE) {
            socket.emit("fullRoom", { msg: "full" }); // 방이 꽉 찬 경우
            return;
        }

        // 방이 존재하면
        if (niceCatchRooms[room]) {
            console.log(
                `Now User Room Size: ${niceCatchRooms[room].length + 1}`
            );
            niceCatchRooms[room].push({ username, id: socket.id, win: 0 });
            socket.emit("videoChatConnect", data); //연결되면 화상연결 시작
        } else {
            // 방이 없으면 생성한다.
            niceCatchRooms[room] = [{ username, id: socket.id, win: 0 }];
            socket.emit("videoChatConnectInit", data); //연결되면 화상연결 시작
        }
        socket.join(room);
    });

    socket.on("send_message", (data) => {
        console.log("send_message", data);
        socket.to(data.room).emit("receive_message", data);
    });

    socket.on("disconnect", () => {
        console.log("User Disconnected", socket.id);
        const roomKeys = Object.keys(niceCatchRooms);
        outer: for (let i = 0; i < roomKeys.length; i++) {
            const key = roomKeys[i];
            for (let j = 0; i < niceCatchRooms[key].length; j++) {
                if (niceCatchRooms[key][j]?.id === socket?.id) {
                    niceCatchRooms[key].splice(j, 1);
                    break outer;
                }
            }
        }
    });

    // 박유나 작업
    /**
     * 방정보 받아오기
     */
    socket.on("myRoomInfo", (data) => {
        const { room } = data;
        // console.log(io.sockets.adapter.rooms);
        // console.log(io.sockets.adapter.rooms.get(socket.id));
        // console.log(io.sockets.adapter.rooms.get(socket.id).length);
        socket.emit("myRoomUserInfo", { data: niceCatchRooms[room] });
    });

    // These events are emitted to all the sockets connected to the same room except the sender.
    socket.on("startCall", (room) => {
        console.log(`Broadcasting start_call event to peers in room ${room}`);
        socket.broadcast
            .to(room)
            .emit("myRoomUserInfo", { data: niceCatchRooms[room] });
        socket.broadcast.to(room).emit("startCall");
    });
    socket.on("webrtcOffer", (event) => {
        console.log(
            `Broadcasting webrtc_offer event to peers in room ${event.room}`
        );
        socket.broadcast.to(event.room).emit("webrtcOffer", event.sdp);
    });
    socket.on("webrtcAnswer", (event) => {
        console.log(
            `Broadcasting webrtc_answer event to peers in room ${event.room}`
        );
        socket.broadcast.to(event.room).emit("webrtcAnswer", event.sdp);
    });
    socket.on("webrtcIceCandidate", (event) => {
        console.log(
            `Broadcasting webrtcIceCandidate event to peers in room ${event.room}`
        );
        socket.broadcast.to(event.room).emit("webrtcIceCandidate", event);
    });
});

server.listen(SERVER_PORT || 3001, () => {
    console.log("Sever Running");
});
