import { soundManager } from '../utils/sound';

interface GameUIProps {
  turnIndex: number;
  myPlayerIndex: number;
  players: any[];
  turnTimeLeft: number;
  angle: number;
  power: number;
  wind: number;
  moveFuel: number;
  weapon: number;
  setWeapon: (w: number) => void;
  setPower: (power: number) => void;
  fireProjectile: () => void;
}

export function GameUI({ turnIndex, myPlayerIndex, players, turnTimeLeft, angle, power, wind, moveFuel, weapon, setWeapon, setPower, fireProjectile }: GameUIProps) {
  const isMyTurn = turnIndex === myPlayerIndex;
  
  const gameOver = players.filter(p => p.hp > 0).length <= 1;
  const winner = gameOver ? players.find(p => p.hp > 0) : null;

  const fuelPercent = (moveFuel / 200) * 100;
  const me = players[myPlayerIndex];

  return (
    <>
      <button 
        onClick={() => {
          if (window.confirm('정말로 게임을 포기하고 로비로 돌아가시겠습니까?')) {
            window.location.reload();
          }
        }}
        className="absolute top-[120px] left-5 z-40 bg-red-600/80 hover:bg-red-500 text-white px-5 py-2 rounded-xl font-bold border-2 border-red-800 shadow-lg backdrop-blur-sm transition-all pointer-events-auto"
      >
        🏳️ 나가기
      </button>

      {/* 📋 [추가] 좌측 상단: 내 상태창 */}
      <div className="absolute top-5 left-5 z-40 pointer-events-none">
        <div className="bg-black/60 backdrop-blur-md p-4 rounded-2xl border-2 border-orange-500 shadow-xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-4 h-4 rounded-full animate-pulse bg-orange-500" />
            <span className="font-black text-xl text-white">MY STATUS</span>
            <span className="text-xs text-orange-300 font-bold ml-auto">{me?.nickname}</span>
          </div>
          
          <div className="w-64 h-5 bg-gray-800 rounded-full overflow-hidden border border-gray-600 shadow-inner">
            <div 
              className="h-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all duration-700"
              style={{ width: `${Math.max(0, (Math.max(0, me?.hp || 0) / 1000) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 px-1">
            <span className="text-[10px] font-bold text-gray-400">HEALTH POINTS</span>
            <span className="text-xs font-black text-white">{Math.floor(Math.max(0, me?.hp || 0))} / 1000</span>
          </div>
        </div>
      </div>

      {gameOver && (
        <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center pointer-events-auto">
          <h1 className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-600 drop-shadow-2xl mb-4 animate-bounce">
            {winner ? `${winner.nickname} WINS!` : 'DRAW!'}
          </h1>
          <button onClick={() => window.location.reload()} className="px-10 py-4 bg-gradient-to-b from-white to-gray-300 text-black font-black text-3xl rounded-2xl shadow-[0_10px_0_rgb(156,163,175)] hover:from-gray-100 hover:to-gray-400 transition-all active:scale-95">
            로비로 돌아가기
          </button>
        </div>
      )}

      {/* ⏱️ 상단 중앙 타이머 및 바람 UI */}
      <div className="absolute top-5 w-full flex flex-col items-center pointer-events-none">
        <div className={`mb-4 px-8 py-3 rounded-2xl flex items-center gap-4 text-5xl font-black drop-shadow-lg border-4 ${
          turnTimeLeft <= 10 ? 'bg-red-600 border-red-400 text-white animate-pulse' : 'bg-black/60 border-gray-500 text-yellow-400'
        }`}>
          ⏳ 00:{turnTimeLeft.toString().padStart(2, '0')}
        </div>
        
        <div className="bg-white/85 backdrop-blur-md border-2 border-gray-300 px-6 py-3 rounded-full shadow-lg flex items-center gap-4">
          <span className="font-black text-gray-800 tracking-widest text-lg">WIND</span>
          <div className="flex items-center gap-2">
            <span className={`text-xl font-bold ${wind < 0 ? 'text-blue-600' : 'text-gray-300'}`}>◀</span>
            <div className="w-24 h-4 bg-gray-200 rounded-l-full overflow-hidden relative">
              {wind < 0 && <div className="absolute right-0 top-0 h-full bg-blue-500 transition-all duration-500" style={{ width: `${Math.abs(wind) * 10}%` }} />}
            </div>
            <span className="w-6 text-center font-black text-gray-800 text-lg">{Math.abs(wind)}</span>
            <div className="w-24 h-4 bg-gray-200 rounded-r-full overflow-hidden relative">
              {wind > 0 && <div className="absolute left-0 top-0 h-full bg-red-500 transition-all duration-500" style={{ width: `${wind * 10}%` }} />}
            </div>
            <span className={`text-xl font-bold ${wind > 0 ? 'text-red-600' : 'text-gray-300'}`}>▶</span>
          </div>
        </div>
      </div>

      {/* 📋 우측 상단 생존자 리스트 및 호버 체력바 */}
      <div className="absolute top-5 right-5 flex flex-col gap-2 pointer-events-auto">
        <div className="text-right text-gray-800 font-black drop-shadow-md mb-2">SURVIVORS</div>
        {players.map((p, idx) => {
           if (p.hp <= 0) return null;
           const isMyPlayer = idx === myPlayerIndex;
           const isActive = idx === turnIndex;
           
           return (
             <div key={p.id || idx} className="group relative flex items-center justify-end">
                {/* 툴팁: 체력바 (마우스 호버 시 표시, 내 탱크거나 내 턴일 땐 항상 표시 고려할 수 있지만 기획대로 호버 시에만) */}
                <div className={`absolute right-full mr-4 bg-white/90 p-3 rounded-xl shadow-lg border-2 ${isMyPlayer ? 'border-orange-400' : 'border-gray-400'} opacity-0 group-hover:opacity-100 group-hover:visible transition-all duration-200 w-48 invisible`}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-gray-700 text-sm">{p.nickname} HP</span>
                    {p.dots && p.dots.length > 0 && <span className="text-[10px] bg-teal-500 text-white px-1.5 rounded-full animate-pulse">🔥 WP</span>}
                  </div>
                  <div className="w-full h-3 bg-gray-300 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-300 ${isMyPlayer ? 'bg-orange-500' : 'bg-red-500'}`} style={{ width: `${Math.max(0, (p.hp / 1000) * 100)}%` }} />
                  </div>
                  <p className="text-right text-xs font-bold mt-1 text-gray-600">{Math.floor(Math.max(0, p.hp))} / 1000</p>
                </div>

                {/* 닉네임 버튼 (리스트) */}
                <div className={`px-4 py-2 rounded-xl border-2 font-bold cursor-help shadow-sm transition-all duration-300 flex items-center gap-2 ${
                  isActive ? 'bg-yellow-400 border-yellow-600 text-black scale-110 -translate-x-2' : 
                  isMyPlayer ? 'bg-orange-500 border-orange-700 text-white' : 'bg-gray-800 border-gray-600 text-white opacity-80'
                }`}>
                  {isActive && <span className="text-xs animate-bounce">▶</span>}
                  {p.nickname}
                </div>
             </div>
           );
        })}
      </div>

      {/* 🎮 조작 패널 (우측 하단) */}
      <div className={`absolute bottom-10 right-10 bg-white/85 backdrop-blur-md p-6 rounded-2xl shadow-2xl border-2 border-gray-300 flex flex-col items-center gap-4 min-w-[340px] transition-all duration-500 ${isMyTurn ? 'opacity-100 scale-100' : 'opacity-50 scale-95 pointer-events-none'}`}>
        <h2 className={`text-2xl font-black ${isMyTurn ? 'text-orange-600' : 'text-gray-500'} border-b-2 border-gray-300 w-full text-center pb-2 mb-1 uppercase`}>
          {isMyTurn ? 'YOUR TURN' : 'WAITING...'}
        </h2>

        {/* 🚀 무기 교체 패널 (7종 무기고) */}
        <div className="grid grid-cols-4 gap-2 w-full mt-1 mb-2">
          <button onClick={() => { soundManager.playClick(); setWeapon(0); }} disabled={!isMyTurn || gameOver} className={`py-2 rounded-lg font-bold text-xs transition-all ${weapon === 0 ? 'bg-red-600 text-white shadow-inner scale-95' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>철갑탄</button>
          <button onClick={() => { soundManager.playClick(); setWeapon(1); }} disabled={!isMyTurn || gameOver} className={`py-2 rounded-lg font-bold text-xs transition-all ${weapon === 1 ? 'bg-orange-500 text-white shadow-inner scale-95' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>소이탄</button>
          <button onClick={() => { soundManager.playClick(); setWeapon(2); }} disabled={!isMyTurn || gameOver} className={`py-2 rounded-lg font-bold text-xs transition-all ${weapon === 2 ? 'bg-teal-600 text-white shadow-inner scale-95' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>백린탄</button>
          <button onClick={() => { soundManager.playClick(); setWeapon(3); }} disabled={!isMyTurn || gameOver} className={`py-2 rounded-lg font-bold text-xs transition-all ${weapon === 3 ? 'bg-green-600 text-white shadow-inner scale-95' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>바운스탄</button>
          <button onClick={() => { soundManager.playClick(); setWeapon(4); }} disabled={!isMyTurn || gameOver} className={`py-2 rounded-lg font-bold text-xs transition-all ${weapon === 4 ? 'bg-purple-600 text-white shadow-inner scale-95' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>텔레포트</button>
          <button onClick={() => { soundManager.playClick(); setWeapon(5); }} disabled={!isMyTurn || gameOver} className={`py-2 rounded-lg font-bold text-xs transition-all ${weapon === 5 ? 'bg-indigo-600 text-white shadow-inner scale-95' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>유도탄</button>
          <button onClick={() => { soundManager.playClick(); setWeapon(6); }} disabled={!isMyTurn || gameOver} className={`col-span-2 py-2 rounded-lg font-bold text-xs transition-all ${weapon === 6 ? 'bg-yellow-500 text-white shadow-inner scale-95' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>에어버스트</button>
        </div>

        <div className="w-full flex justify-between gap-4">
          <p className="text-gray-800 font-bold text-sm bg-gray-100 flex-1 text-center py-2 rounded-md border border-gray-300">각도: {angle}°</p>
          <div className="flex-1 flex flex-col justify-center">
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-gray-700 text-[10px]">MOVE FUEL</span>
              <span className={`font-bold text-[10px] ${moveFuel === 0 ? 'text-red-500 animate-pulse' : 'text-green-600'}`}>{moveFuel === 0 ? 'EMPTY' : moveFuel}</span>
            </div>
            <div className="w-full h-1.5 bg-gray-300 rounded-full overflow-hidden">
               <div className={`h-full ${moveFuel > 50 ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${fuelPercent}%` }} />
            </div>
          </div>
        </div>

        <div className="w-full flex flex-col gap-3">
          <div className="flex justify-between items-center w-full">
            <label htmlFor="power-input" className="font-bold text-gray-700">POWER</label>
            <div className="flex items-center gap-2">
               <input id="power-input" type="number" min="1" max="200" value={power} onChange={(e) => setPower(Number(e.target.value))}
                 onKeyDown={(e) => { if (e.key === ' ') e.preventDefault(); else e.stopPropagation(); }}
                 className="w-20 px-2 py-1 text-right font-mono font-bold text-lg border-2 border-gray-400 rounded-md bg-white focus:outline-none" disabled={!isMyTurn || gameOver} />
               <span className="font-bold text-gray-500">/ 200</span>
            </div>
          </div>
          <input type="range" min="1" max="200" value={power} onChange={(e) => setPower(Number(e.target.value))} onKeyDown={(e) => e.preventDefault()}
            className="w-full h-3 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-gray-700" disabled={!isMyTurn || gameOver} />
        </div>

        <button onClick={fireProjectile} onKeyDown={(e) => { if (e.key === ' ') e.preventDefault(); }} disabled={!isMyTurn || gameOver}
          className={`w-full mt-2 bg-gradient-to-b ${isMyTurn ? 'from-orange-500 to-red-600 hover:from-orange-400 border-red-900' : 'from-gray-500 to-gray-600 border-gray-800'} active:scale-95 text-white font-black text-2xl py-3 rounded-xl shadow-md border-b-4 transition-all disabled:opacity-50`}>
          FIRE! (Space)
        </button>
      </div>
    </>
  );
}