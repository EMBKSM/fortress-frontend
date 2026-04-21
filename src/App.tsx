import { useState } from 'react';
import { useGame } from './hooks/useGame';
import { GameUI } from './components/GameUI';
import { StartScreen } from './components/StartScreen';

function App() {
  const [gameState, setGameState] = useState<'lobby' | 'playing'>('lobby');
  const [selectedMap, setSelectedMap] = useState<number>(1);
  const [selectedSize, setSelectedSize] = useState<number>(30000);
  const [networkData, setNetworkData] = useState<{ roomId: string; playerIndex: number; mapSeed: number, playerCount: number, players: any[], wind: number } | null>(null);

  if (gameState === 'lobby') {
    return (
      <StartScreen 
        onStart={(mapType, mapSize, netData) => {
          setSelectedMap(mapType);
          setSelectedSize(mapSize);
          setNetworkData(netData);
          setGameState('playing');
        }} 
      />
    );
  }

  return <GameStage mapType={selectedMap} mapSize={selectedSize} networkData={networkData} />;
}

// 🚀 GameStage에 networkData 프롭스 추가
function GameStage({ mapType, mapSize, networkData }: { mapType: number, mapSize: number, networkData: { roomId: string; playerIndex: number; mapSeed: number, playerCount: number, players: any[], wind: number } | null }) {
  const { canvasRef, turnIndex, myPlayerIndex, players, turnTimeLeft, angle, power, wind, moveFuel, weapon, setWeapon, setPower, fireProjectile } = useGame(mapType, mapSize, networkData);

  return (
    <div className="relative w-screen h-screen bg-sky-200 overflow-hidden">
      <canvas ref={canvasRef} className="block" />
      <GameUI 
        turnIndex={turnIndex} myPlayerIndex={myPlayerIndex} players={players} turnTimeLeft={turnTimeLeft}
        angle={angle} power={power} wind={wind} moveFuel={moveFuel} 
        weapon={weapon} setWeapon={setWeapon} setPower={setPower} fireProjectile={fireProjectile} 
      />
    </div>
  );
}

export default App;