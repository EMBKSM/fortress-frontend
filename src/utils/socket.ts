// src/utils/socket.ts
import { io } from 'socket.io-client';

// 로컬 테스트용 주소. 나중에 Render에 배포하면 그 주소로 바꿀 겁니다!
const SERVER_URL = 'https://fortress-backend-kh3x.onrender.com';

export const socket = io(SERVER_URL, {
    autoConnect: false, // 앱이 켜지자마자 연결하지 않고, '시작' 버튼을 눌렀을 때만 연결
});
