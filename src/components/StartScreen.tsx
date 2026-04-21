import { useState, useEffect } from 'react';
import { soundManager } from '../utils/sound';
import { socket } from '../utils/socket';

export interface StartScreenProps {
  onStart: (map: number, size: number, networkData: { roomId: string; playerIndex: number; mapSeed: number, playerCount: number, players: any[], wind: number } | null) => void;
}

interface RoomInfo {
  id: string;
  title?: string;
  hasPassword?: boolean;
  mapType: number;
  mapSize: number;
  playerCount: number;
  maxPlayers: number;
  status: string;
}

export function StartScreen({ onStart }: StartScreenProps) {
  const [selectedMap, setSelectedMap] = useState<number>(1);
  const [selectedSize, setSelectedSize] = useState<number>(30000);
  const [showGuide, setShowGuide] = useState(false);

  const [roomTitle, setRoomTitle] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [maxPlayersInput, setMaxPlayersInput] = useState(4);

  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [myRoomId, setMyRoomId] = useState<string | null>(null);
  const [myPlayerIndex, setMyPlayerIndex] = useState<number>(-1);
  const [roomPlayers, setRoomPlayers] = useState<any[]>([]);
  const [maxPlayers, setMaxPlayers] = useState<number>(0);

  useEffect(() => {
    socket.connect();

    socket.on('roomList', (serverRooms: RoomInfo[]) => {
      setRooms(serverRooms);
    });

    socket.on('playerAssigned', (data) => {
      setMyPlayerIndex(data.playerIndex);
      setMyRoomId(data.roomId);
    });

    socket.on('playerJoined', (data) => {
      setRoomPlayers(data.players);
      setMaxPlayers(data.maxPlayers);
    });

    socket.on('error', (msg: string) => {
      alert(msg);
    });

    return () => {
      socket.off('roomList');
      socket.off('playerAssigned');
      socket.off('playerJoined');
      socket.off('error');
    };
  }, []);

  useEffect(() => {
    // Only register gameStart after we join a room, but it's safe to have it on all the time
    const handleGameStart = (data: any) => {
      soundManager.playBGM();
      onStart(selectedMap, selectedSize, {
        roomId: myRoomId || '',
        playerIndex: myPlayerIndex,
        mapSeed: data.mapSeed,
        playerCount: data.players.length,
        players: data.players,
        wind: data.wind
      });
    };

    socket.on('gameStart', handleGameStart);
    return () => {
      socket.off('gameStart', handleGameStart);
    };
  }, [selectedMap, selectedSize, myRoomId, myPlayerIndex, onStart]);

  const handleCreateRoom = () => {
    soundManager.init();
    soundManager.playClick();
    socket.emit('createRoom', { 
      title: roomTitle, 
      password: roomPassword, 
      maxPlayers: maxPlayersInput,
      mapType: selectedMap, 
      mapSize: selectedSize 
    });
  };

  const handleJoinRoom = (roomId: string, mapId: number, size: number, hasPassword?: boolean) => {
    soundManager.init();
    soundManager.playClick();
    setSelectedMap(mapId);
    setSelectedSize(size);
    let pw = '';
    if (hasPassword) {
      pw = window.prompt('비밀번호를 입력하세요') || '';
      if (!pw) return; // 사용자가 취소했거나 빈 값인 경우
    }
    socket.emit('joinRoom', { roomId, password: pw });
  };

  const handleStartGame = () => {
    soundManager.playClick();
    socket.emit('startGame', { roomId: myRoomId });
  };

  const handleLeaveRoom = () => {
    soundManager.playClick();
    socket.emit('leaveRoom');
    setMyRoomId(null);
    setMyPlayerIndex(-1);
    setRoomPlayers([]);
  };

  const maps = [
    { id: 1, name: '시가지 (1:1 특화)', desc: '폭과 높이가 무작위인 빌딩 숲입니다. (소형 고정, 최대 4인)' },
    { id: 2, name: '구릉지대 (경사)', desc: '오르락 내리락하는 다이나믹한 경사 지형입니다. (최대 32인)' },
    { id: 3, name: '대평원 (평야)', desc: '다인 난전에 적합한 아주 넓고 완만한 평야입니다. (최대 32인)' },
    { id: 4, name: '협곡 (경사+평야)', desc: '거대한 산맥과 넓은 평야가 섞인 복합 지형입니다. (최대 32인)' },
  ];

  const sizes = [
    { value: 10000, label: '소형 (10,000px)' },
    { value: 20000, label: '중형 (20,000px)' },
    { value: 30000, label: '대형 (30,000px)' },
  ];

  // =================== 🏠 룸 로비 (대기실) 화면 ===================
  if (myRoomId) {
    return (
      <div className="w-screen h-screen bg-sky-900 flex flex-col items-center justify-center text-white">
        <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-600 mb-8">
          대기실 ({myRoomId})
        </h1>
        <div className="bg-sky-800 p-8 rounded-3xl border-4 border-sky-400 w-full max-w-2xl mb-8">
          <div className="flex justify-between items-end mb-6 border-b-2 border-sky-600 pb-4">
            <h2 className="text-2xl font-bold">참여자 목록</h2>
            <span className="text-xl font-mono text-sky-200">{roomPlayers.length} / {maxPlayers} 명</span>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-h-[40vh] overflow-y-auto">
            {roomPlayers.map((p) => (
              <div key={p.id} className={`p-4 rounded-xl font-bold text-center ${p.index === myPlayerIndex ? 'bg-orange-500 text-white border-2 border-white' : 'bg-sky-700 text-sky-100'}`}>
                {p.index === 0 && <span className="block text-yellow-300 text-xs mb-1">👑 방장</span>}
                {p.nickname}
                {p.index === myPlayerIndex && <span className="block text-xs mt-1">(나)</span>}
              </div>
            ))}
            {/* 빈 자리 채우기 */}
            {Array.from({ length: maxPlayers - roomPlayers.length }).map((_, i) => (
              <div key={`empty-${i}`} className="p-4 rounded-xl font-bold text-center bg-sky-900/50 text-sky-600 border border-sky-800 border-dashed">
                빈 자리
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-4">
          <button
             onClick={handleLeaveRoom}
             className="px-8 py-4 bg-gray-600 hover:bg-gray-500 text-white font-bold text-xl rounded-2xl transition-all"
          >
             방 나가기
          </button>

          {myPlayerIndex === 0 ? (
            <button
              onClick={handleStartGame}
              disabled={roomPlayers.length < 2}
              className={`px-12 py-4 font-black text-2xl rounded-2xl transition-all ${
                roomPlayers.length >= 2 
                  ? 'bg-gradient-to-b from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 text-white shadow-[0_10px_0_rgb(127,29,29)] active:scale-95' 
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              {roomPlayers.length >= 2 ? '게임 시작' : '혼자서는 시작할 수 없습니다'}
            </button>
          ) : (
            <div className="px-12 py-4 bg-gray-800 text-yellow-400 font-black text-2xl rounded-2xl border-4 border-gray-600 animate-pulse">
              방장의 시작을 기다리는 중...
            </div>
          )}
        </div>
      </div>
    );
  }

  // =================== 🌐 방장 모드 & 로비 리스트 화면 ===================
  return (
    <div className="w-screen h-screen bg-sky-900 flex flex-col items-center justify-center text-white selection:bg-none">
      <div className="text-center mb-10 animate-fade-in-down">
        <h1 className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-600 drop-shadow-2xl mb-4">
          FORTRESS WEB
        </h1>
        <p className="text-xl text-sky-200 font-bold tracking-widest">멀티플레이어 대난투에 오신 것을 환영합니다</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8 w-full max-w-6xl px-8 h-[50vh]">
        {/* 🗺️ 새로운 맵 개척 (방 만들기) */}
        <div className="flex-1 bg-sky-800/50 p-6 rounded-3xl border-2 border-sky-600 flex flex-col">
          <h2 className="text-2xl font-bold mb-4 text-orange-400 border-b border-sky-600 pb-2">새 게임 맵 선택</h2>
          <div className="grid grid-cols-1 gap-3 overflow-y-auto pr-2 mb-4">
            {maps.map((map) => (
              <div
                key={map.id}
                onClick={() => {
                  setSelectedMap(map.id);
                  if (map.id === 1) setSelectedSize(10000); // 시가지는 소형으로 고정
                }}
                className={`cursor-pointer p-4 rounded-xl border-2 transition-all duration-200 ${
                  selectedMap === map.id 
                    ? 'bg-white/10 border-orange-500 scale-[1.02] shadow-[0_0_15px_rgba(249,115,22,0.4)]' 
                    : 'bg-black/30 border-transparent hover:bg-white/5 hover:border-gray-500'
                }`}
              >
                <h3 className={`text-lg font-black mb-1 ${selectedMap === map.id ? 'text-orange-400' : 'text-gray-300'}`}>
                  MAP {map.id}. {map.name}
                </h3>
                <p className="text-gray-400 text-xs font-bold leading-relaxed">{map.desc}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mb-6">
            {sizes.map((size) => (
              <button
                key={size.value}
                onClick={() => setSelectedSize(size.value)}
                disabled={selectedMap === 1}
                className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${
                  selectedSize === size.value
                    ? 'bg-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                } ${selectedMap === 1 && 'opacity-50 cursor-not-allowed'}`}
              >
                {size.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 mb-4">
            <input 
              placeholder="방 제목 입력 (없으면 자동 생성)" 
              className="bg-black/30 border border-sky-600 p-2 rounded-lg text-white"
              value={roomTitle} onChange={e => setRoomTitle(e.target.value)}
            />
            <input 
              type="password" placeholder="비밀번호 (선택)" 
              className="bg-black/30 border border-sky-600 p-2 rounded-lg text-white"
              value={roomPassword} onChange={e => setRoomPassword(e.target.value)}
            />
            <div className="flex items-center justify-between">
              <span className="font-bold">최대 인원:</span>
              <select 
                className="bg-sky-700 p-2 rounded-lg font-bold text-white outline-none border border-sky-600 focus:border-orange-500"
                value={maxPlayersInput} onChange={e => setMaxPlayersInput(parseInt(e.target.value))}
                disabled={selectedMap === 1}
              >
                {[2, 4, 8, 16, 32].map(n => <option key={n} value={n}>{n}명</option>)}
              </select>
            </div>
            {selectedMap === 1 && <span className="text-xs text-orange-400 -mt-2">시가지는 최대 4명으로 제한됩니다.</span>}
          </div>

          <button
            onClick={handleCreateRoom}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 active:scale-95 text-white font-black text-xl rounded-xl shadow-[0_5px_0_rgb(153,27,27)] transition-all mt-auto"
          >
            선택한 맵으로 방 만들기
          </button>
        </div>

        {/* 🚪 열려있는 방 리스트 */}
        <div className="flex-1 bg-sky-800/50 p-6 rounded-3xl border-2 border-sky-600 flex flex-col">
          <h2 className="text-2xl font-bold mb-4 text-green-400 border-b border-sky-600 pb-2">현재 대기 중인 로비</h2>
          <div className="flex-1 overflow-y-auto pr-2 space-y-3">
            {rooms.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-sky-300/50 font-bold">
                <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <p>열려있는 방이 없습니다.</p>
                <p className="text-sm mt-2">왼쪽에서 직접 방을 만들어보세요!</p>
              </div>
            ) : (
              rooms.map((room) => (
                <div key={room.id} className="bg-black/30 p-4 rounded-xl border border-sky-700 font-bold flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-white text-lg">{room.title || `방 번호: ${room.id}`}</div>
                      {room.hasPassword && <span className="text-xs bg-red-600/80 px-2 py-0.5 rounded-full text-white">🔒 비밀번호</span>}
                    </div>
                    <div className="text-sky-300 text-sm mt-1">{maps.find(m => m.id === room.mapType)?.name || 'Unknown Map'} | {sizes.find(s => s.value === room.mapSize)?.label}</div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className={`text-lg ${room.playerCount >= room.maxPlayers ? 'text-red-400' : 'text-green-400'} mb-2`}>
                      {room.playerCount} / {room.maxPlayers}
                    </span>
                    <button
                      onClick={() => handleJoinRoom(room.id, room.mapType, room.mapSize, room.hasPassword)}
                      disabled={room.playerCount >= room.maxPlayers || room.status !== 'waiting'}
                      className={`px-6 py-2 rounded-lg font-black text-white transition-all ${
                        room.playerCount >= room.maxPlayers || room.status !== 'waiting'
                          ? 'bg-gray-600 cursor-not-allowed'
                          : 'bg-green-600 hover:bg-green-500 active:scale-95 shadow-[0_4px_0_rgb(21,128,61)]'
                      }`}
                    >
                      {room.status === 'playing' ? '게임 중' : (room.playerCount >= room.maxPlayers ? '인원 초과' : '참여하기')}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <button
          onClick={() => setShowGuide(true)}
          className="px-10 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-colors"
        >
          게임 가이드 보기
        </button>
      </div>

      {showGuide && (
         <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-8 backdrop-blur-sm animate-fade-in">
           <div className="bg-sky-50 text-gray-800 w-full max-w-4xl max-h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border-4 border-sky-300">
             <div className="bg-sky-200 p-6 flex justify-between items-center border-b-2 border-sky-300">
               <h2 className="text-3xl font-black text-sky-900">🎮 포트리스 WEB 플레이 가이드</h2>
               <button onClick={() => setShowGuide(false)} className="text-3xl font-bold text-sky-700 hover:text-red-500 transition-colors">✕</button>
             </div>
             <div className="p-8 overflow-y-auto flex flex-col gap-8 text-lg">
               {/* 조작법 */}
               <section>
                 <h3 className="text-xl font-black text-red-600 mb-3 border-b-2 border-red-200 pb-2">🕹️ 기본 조작법</h3>
                 <ul className="list-disc list-inside space-y-2 font-semibold text-gray-700">
                   <li><span className="text-blue-600">이동:</span> 방향키 <kbd className="bg-gray-200 px-2 rounded">←</kbd> <kbd className="bg-gray-200 px-2 rounded">→</kbd> (이동 시 Fuel 소모)</li>
                   <li><span className="text-blue-600">포신 조준:</span> 방향키 <kbd className="bg-gray-200 px-2 rounded">↑</kbd> <kbd className="bg-gray-200 px-2 rounded">↓</kbd></li>
                   <li><span className="text-blue-600">궤적 예측 (조준경):</span> 스페이스바 1회 누르기</li>
                   <li><span className="text-red-600">포탄 발사:</span> 궤적 예측 상태에서 스페이스바 1회 더 누르기</li>
                 </ul>
               </section>
               {/* 기존 가이드 내용 생략 복원용 (축소) - 실제로는 이대로 둡니다 */}
               <section>
                <p className="text-gray-600 text-sm">상세 가이드는 게임 내 무기 도감을 참고하세요!</p>
               </section>
             </div>
           </div>
         </div>
       )}
    </div>
  );
}
