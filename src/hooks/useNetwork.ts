import { useEffect, useRef } from 'react';
import { socket } from '../utils/socket';

export function useNetwork(
  gameState: any,
  myPlayerIndex: number,
  roomId: string | undefined,
  callbacks: {
    onTurnChanged: (idx: number) => void;
    onTimerUpdate: (time: number) => void;
    onOpponentFire: (weapon: number) => void;
  }
) {
  // 🛡️ 콜백을 ref에 저장 → 렌더링마다 소켓이 재연결되는 대참사 방지!
  const callbacksRef = useRef(callbacks);
  useEffect(() => { callbacksRef.current = callbacks; }, [callbacks]);

  useEffect(() => {
    if (!roomId) return;

    socket.on('opponentUpdate', (data) => {
      const state = gameState.current;
      if (state.players[data.playerIndex]) {
        state.players[data.playerIndex].angle = data.angle;
        state.players[data.playerIndex].power = data.power;
      }
    });

    socket.on('opponentMove', (data) => {
      const state = gameState.current;
      if (state.players[data.playerIndex]) {
        state.players[data.playerIndex].x = data.x;
        state.players[data.playerIndex].direction = data.direction;
      }
    });

    socket.on('opponentFire', (data) => {
      callbacksRef.current.onOpponentFire(data.weaponType);
    });

    socket.on('turnChanged', (data) => {
      const state = gameState.current;
      state.turnIndex = data.turnIndex;
      if (data.wind !== undefined) state.wind = data.wind;
      state.isTurnActive = false;
      
      // 🛡️ [삭제] state.lastTrails = {};  <- 내 궤적을 보존하기 위해 삭제
      // 대신 조준선(Preview)만 꺼줍니다.
      state.isPreviewing = false; 

      state.players.forEach((p: any) => p.fuel = p.maxFuel);
      callbacksRef.current.onTurnChanged(data.turnIndex);
    });

    socket.on('turnTimer', (data) => {
      callbacksRef.current.onTimerUpdate(data.timeLeft);
    });

    return () => {
      socket.off('opponentUpdate');
      socket.off('opponentMove');
      socket.off('opponentFire');
      socket.off('turnChanged');
      socket.off('turnTimer');
    };
  }, [roomId, myPlayerIndex, gameState]); // 🚀 callbacks 의존성 제거!

  const emitPlayerUpdate = (angle: number, power: number) => {
    if (roomId) socket.emit('playerUpdate', { roomId, playerIndex: myPlayerIndex, angle, power });
  };

  const emitMove = (x: number, direction: number) => {
    if (roomId) socket.emit('playerMove', { roomId, playerIndex: myPlayerIndex, x, direction });
  };

  const emitFire = (weaponType: number) => {
    if (roomId) socket.emit('playerFire', { roomId, weaponType });
  };

  const emitHpSync = (hpUpdates: any[]) => {
    if (roomId) socket.emit('syncHp', { roomId, hpUpdates });
  };

  const emitActionCompleted = () => {
    if (roomId) socket.emit('actionCompleted', { roomId });
  };

  return { emitPlayerUpdate, emitMove, emitFire, emitHpSync, emitActionCompleted };
}
