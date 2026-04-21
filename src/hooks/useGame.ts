import { useEffect, useRef, useState, useCallback } from 'react';
import { usePhysics } from './usePhysics';
import { useNetwork } from './useNetwork';
import { useRender } from './useRender';

export function useGame(mapType: number, mapSize: number, networkData: { roomId: string; playerIndex: number; mapSeed: number } | null) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const myPlayerIndex = networkData?.playerIndex ?? 0;

  // React State for UI
  const [turnIndexState, setTurnIndexState] = useState(networkData ? (networkData as any).turnIndex || 0 : 0);
  const [turnTimeLeft, setTurnTimeLeft] = useState(40);
  const [angle, setAngle] = useState(45);
  const [power, setPowerState] = useState(100);
  
  const setPower = useCallback((val: number) => {
    let safeVal = Number(val);
    if (isNaN(safeVal)) safeVal = 1;
    setPowerState(Math.max(1, Math.min(200, safeVal)));
  }, []);
  const [wind, setWind] = useState(0);
  const [moveFuel, setMoveFuel] = useState(200);
  const [weapon, setWeapon] = useState(0);
  const [syncedPlayers, setSyncedPlayers] = useState<any[]>(networkData ? (networkData as any).players || [] : []);

  // 1. Physics Engine Connection
  const { gameState, initWorld, updatePhysics, fireProjectile } = usePhysics(mapType, mapSize, networkData);

  // Sync React State with Physics state
  useEffect(() => { 
    const currentTank = gameState.current.players[gameState.current.turnIndex];
    if (currentTank) {
        currentTank.angle = angle; 
        currentTank.power = power;
    }
  }, [angle, power, gameState]);

  useEffect(() => { gameState.current.weapon = weapon; }, [weapon, gameState]);

  // UI Polling synchronization
  useEffect(() => {
    const interval = setInterval(() => {
      setSyncedPlayers([...gameState.current.players]);
      setWind(gameState.current.wind);
    }, 500);
    return () => clearInterval(interval);
  }, [gameState]);

  // 2. Network Engine Connection
  const { emitPlayerUpdate, emitMove, emitFire, emitHpSync, emitActionCompleted } = useNetwork(
    gameState, myPlayerIndex, networkData?.roomId, 
    {
      onTurnChanged: (idx: number) => {
          setTurnIndexState(idx);
          setMoveFuel(200); // UI ref count 
      },
      onTimerUpdate: (time: number) => setTurnTimeLeft(time),
      onOpponentFire: (wpn: number) => {
        setWeapon(wpn);
        setTimeout(() => fireProjectile(), 50);
      }
    }
  );

  // Network emit for angle/power
  useEffect(() => {
    if (gameState.current.turnIndex === myPlayerIndex) {
      emitPlayerUpdate(angle, power);
    }
  }, [angle, power, myPlayerIndex, emitPlayerUpdate, gameState]);

  // Wrap fireProjectile to emit network event simultaneously
  const handleFireProjectile = useCallback(() => {
    fireProjectile();
    // Only send the event if it's our turn
    if (gameState.current.turnIndex === myPlayerIndex) {
        emitFire(gameState.current.weapon);
    }
  }, [fireProjectile, myPlayerIndex, emitFire, gameState]);

  // Keyboard Handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = gameState.current;
      const currentTank = state.players[state.turnIndex];
      
      if (state.turnIndex !== myPlayerIndex) return; 

      if (!currentTank || currentTank.hp <= 0) return;
      if (document.activeElement?.id === 'power-input' && e.key !== ' ') return;

      if (!state.isTurnActive) {
        if (e.key === 'ArrowUp') setAngle((p) => Math.min(p + 1, 90));
        if (e.key === 'ArrowDown') setAngle((p) => Math.max(p - 1, 0));
        if (e.key === 'ArrowLeft') { state.keys.left = true; currentTank.direction = -1; }
        if (e.key === 'ArrowRight') { state.keys.right = true; currentTank.direction = 1; }
      }

      if (e.key === ' ' && !e.repeat) {
        e.preventDefault();
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();

        if (state.isTurnActive) {
          let triggered = false;
          state.projectiles.forEach((p: any) => {
            if (p.weaponType === 6 && p.ownerIndex === state.turnIndex && !p.forceExplode) {
              p.forceExplode = true;
              p.vx = 0;
              p.vy = 20;
              triggered = true;
            }
          });
          if (triggered) return;
        } else {
          if (!state.isPreviewing) {
              state.isPreviewing = true;
          } else {
              handleFireProjectile();
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') gameState.current.keys.left = false;
      if (e.key === 'ArrowRight') gameState.current.keys.right = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
  }, [handleFireProjectile, gameState]);

  // 3. Render Engine Connection
  const { drawScene } = useRender(gameState);

  // Main Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const gravity = 0.125;
    
    // ⏱️ 이전 프레임의 시간을 기억할 변수
    let lastTime = performance.now(); 

    const gameLoop = (currentTime: number) => { 
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      initWorld(canvas.height);

      // ⏱️ 밀린 시간(Delta Time) 계산
      const dt = currentTime - lastTime;
      lastTime = currentTime;

      if (dt > 100) { // 0.1초 이상 멈췄다가 돌아온 경우 (탭 전환 등)
        const framesToRun = Math.min(Math.floor(dt / 16), 300); // 최대 5초치만
        for (let i = 0; i < framesToRun; i++) {
          updatePhysics(0.125, myPlayerIndex, {
             updateFuel: (fuel: number) => setMoveFuel(fuel),
             onEmitMove: (x: number, direction: number) => emitMove(x, direction),
             onEmitHpSync: (hpUpdates: any[]) => emitHpSync(hpUpdates),
             onEmitActionCompleted: () => emitActionCompleted(),
             updateWind: (w: number) => setWind(w)
          }, canvas.height);
        }
        
        // 🚀 [추가] 물리 엔진 '빨리감기' 직후에 현재 턴 플레이어 정보를 UI에 강제 동기화
        const state = gameState.current;
        setTurnIndexState(state.turnIndex);
        setSyncedPlayers([...state.players]); 
      } else {
        updatePhysics(0.125, myPlayerIndex, {
           updateFuel: (fuel: number) => setMoveFuel(fuel),
           onEmitMove: (x: number, direction: number) => emitMove(x, direction),
           onEmitHpSync: (hpUpdates: any[]) => emitHpSync(hpUpdates),
           onEmitActionCompleted: () => emitActionCompleted(),
           updateWind: (w: number) => setWind(w)
        }, canvas.height);
      }

      // 연산이 다 끝나고 최종 결과만 1번 화면에 그립니다.
      drawScene(ctx, canvas, mapType, gravity);

      animationId = requestAnimationFrame(gameLoop);
    };

    animationId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationId);
  }, [initWorld, updatePhysics, drawScene, mapType, myPlayerIndex, emitMove, emitHpSync, emitActionCompleted]);

  return { 
    canvasRef, 
    turnIndex: turnIndexState, 
    myPlayerIndex, 
    players: syncedPlayers, 
    turnTimeLeft, 
    angle, 
    power, 
    wind, 
    moveFuel, 
    weapon, 
    setWeapon, 
    setPower, 
    fireProjectile: handleFireProjectile 
  };
}