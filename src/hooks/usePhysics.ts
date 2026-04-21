import { useRef, useCallback } from 'react';
import { createSeededRandom } from '../utils/seedRuntime';
import { soundManager } from '../utils/sound';

export interface Cloud { x: number; y: number; width: number; height: number; speedFactor: number; opacity: number; }
export interface DotEffect { duration: number; damagePerTurn: number; }
export interface PlayerState {
  id: string; index: number; nickname: string;
  x: number; width: number; height: number; speed: number; color: string;
  direction: number; angle: number; power: number; hp: number; fuel: number; maxFuel: number; dots: DotEffect[];
}

export function usePhysics(mapType: number, mapSize: number, networkData: any) {
  const gameState = useRef({
    turnIndex: networkData?.turnIndex || 0,
    totalTurns: 0,
    wind: networkData?.wind !== undefined ? networkData.wind : (Math.floor(Math.random() * 21) - 10),
    isPreviewing: false,
    isTurnActive: false,
    weapon: 0,
    lastTrails: {} as Record<number, { x: number, y: number }[]>,
    players: [] as PlayerState[],
    projectiles: [] as { x: number; y: number; vx: number; vy: number; initialPower: number; flightTime: number; weaponType: number; splitStage: number; isDud: boolean; splitTimer: number; isPrimary: boolean; ownerIndex: number; bounces: number; forceExplode: boolean }[],
    duds: [] as { x: number; y: number; turnsLeft: number; damage: number; radius: number }[],
    fires: [] as { x: number; y: number; turnsLeft: number; radius: number }[],
    explosions: [] as { x: number; y: number; radius: number; alpha: number; energy: number; weaponType: number }[],
    terrain: [] as number[],
    buildings: [] as { left: number; right: number; height: number }[],
    WORLD_WIDTH: mapSize,
    camera: { x: 0, y: 0, zoom: 1.0 },
    keys: { left: false, right: false },
    clouds: [] as Cloud[],
    lastMoveEmit: 0
  });

  const initialSpawns = useRef<number[]>([]);
  if (initialSpawns.current.length === 0) {
    const numPlayers = networkData?.playerCount || 2;
    const minDist = mapSize * (100 / (numPlayers + 5)) / 100;
    const spawns: number[] = [];
    const seedRnd = createSeededRandom(networkData?.mapSeed || 12345);
    for (let i = 0; i < numPlayers; i++) {
      let pos = 0, valid = false, attempts = 0;
      while (!valid && attempts < 200) {
        pos = mapSize * 0.05 + seedRnd() * (mapSize * 0.9);
        valid = spawns.every(s => Math.abs(s - pos) >= minDist);
        attempts++;
      }
      if (!valid) pos = mapSize * 0.1 + (mapSize * 0.8 * (i / Math.max(1, numPlayers - 1)));
      spawns.push(pos);
    }
    initialSpawns.current = spawns;

    const colors = ['#fb923c', '#3b82f6', '#4ade80', '#c084fc', '#facc15', '#f472b6', '#2dd4bf', '#fb7185'];
    gameState.current.players = (networkData?.players || [
      { id: 'p1', index: 0, nickname: 'P1', hp: 1000 },
      { id: 'p2', index: 1, nickname: 'P2', hp: 1000 }
    ]).map((p: any, i: number) => ({
      id: p.id, index: p.index, nickname: p.nickname,
      x: initialSpawns.current[i], width: 60, height: 30, speed: 5, color: colors[i % colors.length],
      direction: initialSpawns.current[i] < mapSize / 2 ? 1 : -1,
      angle: 45, power: 100, hp: p.hp, fuel: 200, maxFuel: 200, dots: [] as DotEffect[]
    }));
  }

  const initializeClouds = useCallback((worldWidth: number, canvasHeight: number) => {
    const clouds: Cloud[] = [];
    for (let i = 0; i < Math.ceil(worldWidth / 300); i++) {
      const speedFactor = 0.5 + Math.random() * 2;
      clouds.push({
        x: Math.random() * worldWidth, y: canvasHeight * 0.1 + Math.random() * (canvasHeight * 0.4),
        width: 100 + Math.random() * 250, height: 40 + Math.random() * 80,
        speedFactor: speedFactor, opacity: 0.1 + (speedFactor / 2.5) * 0.6,
      });
    }
    return clouds;
  }, []);

  const initWorld = useCallback((canvasHeight: number) => {
    const state = gameState.current;
    if (state.terrain.length === state.WORLD_WIDTH) return;

    state.terrain = [];
    const seededRandom = createSeededRandom(networkData?.mapSeed || 12345);
    const offsets = [seededRandom() * 10000, seededRandom() * 10000, seededRandom() * 10000];

    let buildingEndX = 0;
    let buildingHeight = 0;
    state.buildings = [];

    for (let x = 0; x < state.WORLD_WIDTH; x++) {
      const baseHeight = canvasHeight * 0.7;
      let y = baseHeight;

      if (mapType === 1) {
        y += Math.sin(x / 500) * 20;
        if (x >= buildingEndX) {
          const rand = seededRandom();
          if (rand < 0.5) {
            const bw = 150 + seededRandom() * 300;
            buildingHeight = 50 + seededRandom() * 300;
            buildingEndX = x + bw;
            state.buildings.push({ left: x, right: Math.min(x + bw, state.WORLD_WIDTH), height: buildingHeight });
          } else if (rand < 0.75) {
            buildingEndX = x + 20 + seededRandom() * 60;
            buildingHeight = 0;
          } else {
            buildingEndX = x + 100 + seededRandom() * 200;
            buildingHeight = 0;
          }
        }
        y -= buildingHeight;
      } else if (mapType === 2) {
        y += Math.sin((x + offsets[0]) / 800) * 250;
        y += Math.sin((x + offsets[1]) / 300) * 100;
        y += Math.sin((x + offsets[2]) / 100) * 30;
      } else if (mapType === 3) {
        y += Math.sin((x + offsets[0]) / 2000) * 100;
        y += Math.sin((x + offsets[1]) / 500) * 20;
      } else if (mapType === 4) {
        y += Math.sin((x + offsets[0]) / 4000) * 400;
        y += Math.sin((x + offsets[1]) / 600) * 40;
      }

      y += Math.sin(x / 20) * 5;
      state.terrain[x] = y;
    }

    state.clouds = initializeClouds(state.WORLD_WIDTH, canvasHeight);
  }, [mapType, mapSize, networkData, initializeClouds]);

  const fireProjectile = useCallback(() => {
    const state = gameState.current;
    const currentTank = state.players[state.turnIndex];

    if (currentTank.power > 0 && !state.isTurnActive && currentTank.hp > 0) {
      const radian = (currentTank.angle * Math.PI) / 180;
      const trueRadian = currentTank.direction === 1 ? radian : Math.PI - radian;
      const MathFloor = Math.floor;
      const cx = currentTank.x + currentTank.width / 2;
      const cy = state.terrain[MathFloor(cx)] || window.innerHeight - 200;
      const x1 = Math.max(0, MathFloor(cx - 20));
      const x2 = Math.min(state.WORLD_WIDTH - 1, MathFloor(cx + 20));
      const tankAngle = Math.atan2(state.terrain[x2] - state.terrain[x1], x2 - x1);

      const turretBaseX = cx + (currentTank.height + 5) * Math.sin(tankAngle);
      const turretBaseY = cy - (currentTank.height + 5) * Math.cos(tankAngle);
      const startX = turretBaseX + Math.cos(trueRadian) * 40;
      const startY = turretBaseY - Math.sin(trueRadian) * 40;

      const velocityMultiplier = 0.4;
      const vx = Math.cos(trueRadian) * currentTank.power * velocityMultiplier;
      const vy = -Math.sin(trueRadian) * currentTank.power * velocityMultiplier;

      state.lastTrails[state.turnIndex] = [];

      state.projectiles.push({
        x: startX, y: startY, vx, vy,
        initialPower: currentTank.power, flightTime: 0,
        weaponType: state.weapon,
        splitStage: 0,
        isDud: false,
        splitTimer: 0,
        isPrimary: true,
        ownerIndex: state.turnIndex,
        bounces: 0,
        forceExplode: false
      });

      soundManager.playShoot();

      state.isPreviewing = false;
      state.isTurnActive = true;
    }
  }, []);

  const updatePhysics = useCallback((gravity: number, myPlayerIndex: number, callbacks: any, canvasHeight: number) => {
    const state = gameState.current;
    const currentTank = state.players[state.turnIndex];
    let hasMoved = false;

    if (!state.isTurnActive && currentTank.hp > 0 && currentTank.fuel > 0) {
      if (state.keys.left) { currentTank.x -= currentTank.speed; hasMoved = true; }
      if (state.keys.right) { currentTank.x += currentTank.speed; hasMoved = true; }
      if (hasMoved) {
        currentTank.x = Math.max(0, Math.min(currentTank.x, state.WORLD_WIDTH - currentTank.width));
        currentTank.fuel = Math.max(0, currentTank.fuel - 1);

        callbacks.updateFuel(currentTank.fuel);

        if (state.turnIndex === myPlayerIndex) {
          const now = Date.now();
          if (now - state.lastMoveEmit > 100) {
            state.lastMoveEmit = now;
            callbacks.onEmitMove(currentTank.x, currentTank.direction);
          }
        }

        for (let d = state.duds.length - 1; d >= 0; d--) {
          const dud = state.duds[d];
          if (Math.abs((currentTank.x + currentTank.width / 2) - dud.x) < currentTank.width / 2) {
            state.explosions.push({ x: dud.x, y: dud.y, radius: 5, alpha: 1, energy: dud.radius * 2, weaponType: 1 });
            const directDamage = dud.damage * 2.0;
            currentTank.hp = Math.max(0, currentTank.hp - Math.max(1, Math.floor(directDamage)));
            state.duds.splice(d, 1);
          }
        }

        state.fires.forEach(fire => {
          const dist = Math.hypot((currentTank.x + currentTank.width / 2) - fire.x, state.terrain[Math.floor(currentTank.x + currentTank.width / 2)] - fire.y);
          if (dist < fire.radius + 30) {
            const hasStrongDot = currentTank.dots.some(d => d.duration >= 3);
            if (!hasStrongDot) {
              currentTank.dots.push({ duration: 4, damagePerTurn: 20 });
            }
          }
        });
      }
    } else if (!hasMoved && state.turnIndex === myPlayerIndex && !state.keys.left && !state.keys.right && state.lastMoveEmit > 0) {
      if (Date.now() - state.lastMoveEmit > 50) {
        callbacks.onEmitMove(currentTank.x, currentTank.direction);
        state.lastMoveEmit = 0;
      }
    }

    // Process explosions
    for (let i = state.explosions.length - 1; i >= 0; i--) {
      const exp = state.explosions[i];
      exp.radius += (exp.energy - exp.radius) * 0.2;
      exp.alpha -= 0.02;
      if (exp.alpha <= 0) { state.explosions.splice(i, 1); continue; }
    }

    // Process projectiles
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const p = state.projectiles[i];

      if (p.weaponType === 1 && p.vy > 0 && p.splitStage < 4) {
        p.splitTimer += 1;
        if (p.splitTimer >= 25) {
          p.splitStage += 1;
          p.splitTimer = 0;

          const spread = p.splitStage * 1.5;
          p.vx -= spread / 2;

          const isDudChance = () => p.splitStage === 4 && Math.random() < 0.3;
          p.isDud = isDudChance();

          state.projectiles.push({
            ...p,
            vx: p.vx + spread,
            isDud: isDudChance(),
            splitTimer: 0,
            isPrimary: false
          });
        }
      }

      const currentWindAccel = p.weaponType === 0 ? 0 : state.wind * 0.001;
      p.vx += currentWindAccel;
      p.vy += gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.flightTime += 1;

      if (p.weaponType === 6 && p.forceExplode) {
        p.vx = 0;
        p.vy = 20;
      }

      // 궤적 기록 로직: 5프레임마다 점을 찍어 성능 최적화
      if (p.isPrimary && p.flightTime % 5 === 0) {
        if (!state.lastTrails[p.ownerIndex]) {
            state.lastTrails[p.ownerIndex] = [];
        }
        state.lastTrails[p.ownerIndex].push({ x: p.x, y: p.y });
      }

      const currentX = Math.floor(p.x);
      if (currentX < 0 || currentX >= state.WORLD_WIDTH || p.y > canvasHeight + 3000) {
        state.projectiles.splice(i, 1);
        continue;
      }

      if (p.weaponType === 5 && p.vy > 0) {
        const target = state.players[(p.ownerIndex + 1) % state.players.length];
        if (target && target.hp > 0) {
          const targetX = target.x + target.width / 2;
          const targetY = state.terrain[Math.floor(targetX)] - target.height / 2;

          const speed = Math.hypot(p.vx, p.vy);
          const angleToTarget = Math.atan2(targetY - p.y, targetX - p.x);
          const errorMargin = (Math.random() - 0.5) * 0.3;
          const finalAngle = angleToTarget + errorMargin;

          p.vx = Math.cos(finalAngle) * speed;
          p.vy = Math.sin(finalAngle) * speed;

          p.vx -= state.wind * 0.001;
          p.vy -= gravity;
        }
      }

      const groundYAtProjectile = state.terrain[currentX];
      let hitTank = false;
      state.players.forEach(t => {
        if (t.hp <= 0) return;
        const tGroundY = state.terrain[Math.floor(t.x + t.width / 2)];
        if (p.x >= t.x && p.x <= t.x + t.width && p.y >= tGroundY - t.height && p.y <= tGroundY) {
          hitTank = true;
        }
      });

      const hitGround = p.y >= groundYAtProjectile || hitTank;

      if (hitGround) {
        if (hitGround && p.weaponType === 3 && p.bounces < 3) {
          soundManager.playBounce();
          p.vy = -Math.abs(p.vy) * 0.6;
          p.vx *= 0.8;
          p.y = groundYAtProjectile - 1;
          p.bounces += 1;
          continue;
        }

        const ex = p.x;
        const ey = hitTank ? p.y : Math.min(p.y, groundYAtProjectile);

        if (p.weaponType === 4) {
          soundManager.playTeleport();
          const owner = state.players[p.ownerIndex];
          if (owner) {
            owner.x = Math.max(0, Math.min(ex - owner.width / 2, state.WORLD_WIDTH - owner.width));
          }
          state.explosions.push({ x: ex, y: ey, radius: 5, alpha: 1, energy: 30, weaponType: 4 });
          state.projectiles.splice(i, 1);
          continue;
        }

        if (p.weaponType === 2 && !p.isDud) {
          state.fires.push({ x: ex, y: ey, turnsLeft: 2, radius: 65 });
          for (let f = 0; f < 4; f++) {
            const spreadX = Math.max(0, Math.min(state.WORLD_WIDTH - 1, ex + (Math.random() - 0.5) * 350));
            const spreadY = state.terrain[Math.floor(spreadX)];
            state.fires.push({ x: spreadX, y: spreadY, turnsLeft: 2, radius: 40 });
          }
        }

        if (!p.isDud) {
          const vol = p.weaponType === 1 ? 0.2 : ((p.initialPower || 100) / 100);
          soundManager.playExplosion(p.weaponType, Math.min(vol || 1, 1.5));
        }

        const safePower = isNaN(p.initialPower) ? 100 : p.initialPower; 
        const flightBonus = 1 + (p.flightTime * 0.015);
        let maxDamage = (safePower * 5) * flightBonus;
        let R = Math.max(20, (safePower * 0.8) / flightBonus);

        if (p.weaponType === 3 && p.bounces > 0) {
          maxDamage *= Math.pow(1.1, p.bounces);
        }

        if (p.weaponType === 1) {
          R *= 1.2;
        } else if (p.weaponType === 2) {
          R *= 1.56;
        } else if (p.weaponType === 0) {
          const destroyR = R * 0.8;
          for (let dx = Math.floor(ex - destroyR); dx <= Math.ceil(ex + destroyR); dx++) {
            if (dx >= 0 && dx < state.WORLD_WIDTH) {
              const inside = destroyR * destroyR - (dx - ex) * (dx - ex);
              const dy = inside > 0 ? Math.sqrt(inside) : 0;
              state.terrain[dx] = Math.min(canvasHeight + 2000, Math.max(state.terrain[dx], ey + dy));
            }
          }
        }
        else if (p.weaponType === 5) {
          R = safePower * 0.4;
        }
        else if (p.weaponType === 6) {
          R = safePower * 1.2;
          maxDamage = 500 * 0.5;
        }

        if (isNaN(R) || R < 0) R = 20;
        if (isNaN(maxDamage)) maxDamage = 50;

        if (p.isDud) {
          const dudDamage = (maxDamage * 0.1) / Math.pow(2, p.splitStage);
          state.duds.push({ x: ex, y: ey, turnsLeft: 2, damage: dudDamage, radius: R });
          state.projectiles.splice(i, 1);
          continue;
        }

        state.explosions.push({ x: ex, y: ey, radius: 5, alpha: 1, energy: R * 2, weaponType: p.weaponType });

        state.players.forEach((t) => {
          if (t.hp <= 0) return;
          const cx = t.x + t.width / 2;
          const cy = state.terrain[Math.floor(cx)] - t.height / 2;
          const rawDist = Math.hypot(cx - ex, cy - ey);
          const dist = Math.max(0, rawDist - 25);

          let baseDmg = 0;
          if (p.weaponType === 0 && dist <= R * 0.5) {
            baseDmg = 2000;
          } else if (dist <= R * 0.5) {
            baseDmg = maxDamage * 2.0;
          }
          if (p.weaponType === 5) {
            if (dist <= R * 2) baseDmg = 50;
          } else {
            if (dist <= R * 0.5) baseDmg = maxDamage * 2.0;
            else if (dist <= R) baseDmg = maxDamage * 0.9;
            else if (dist <= R * 2) baseDmg = maxDamage * 0.3;
          }

          if (baseDmg > 0) {
            let finalDmg = baseDmg;

            if (p.weaponType === 1) {
              finalDmg = (baseDmg * 0.1) / Math.pow(2, p.splitStage);
            } else if (p.weaponType === 2) {
              finalDmg = baseDmg * 0.6;
              const dotDmg = baseDmg * 0.2;
              t.dots.push({ duration: 6, damagePerTurn: Math.max(1, Math.floor(dotDmg)) });
            }

            t.hp = Math.max(0, t.hp - Math.max(1, Math.floor(finalDmg)));
          }
        });
        state.projectiles.splice(i, 1);
      }
    }

    if (state.isTurnActive && state.projectiles.length === 0 && state.explosions.length === 0) {
      state.isTurnActive = false;

      state.duds.forEach(dud => dud.turnsLeft -= 1);
      state.duds = state.duds.filter(dud => dud.turnsLeft > 0);

      state.players.forEach((t) => {
        if (t.hp > 0 && t.dots.length > 0) {
          t.dots.forEach(dot => {
            t.hp = Math.max(0, t.hp - dot.damagePerTurn);
            dot.duration -= 1;
          });
          t.dots = t.dots.filter(dot => dot.duration > 0);
        }
      });

      state.fires.forEach(fire => fire.turnsLeft -= 1);
      state.fires = state.fires.filter(fire => fire.turnsLeft > 0);

      state.players.forEach((t) => {
        state.fires.forEach(fire => {
          const dist = Math.hypot((t.x + t.width / 2) - fire.x, state.terrain[Math.floor(t.x + t.width / 2)] - fire.y);
          if (dist < fire.radius + 30 && t.hp > 0) {
            const hasStrongDot = t.dots.some(d => d.duration >= 3);
            if (!hasStrongDot) t.dots.push({ duration: 4, damagePerTurn: 20 });
          }
        });
      });

      state.totalTurns += 1;

      if (state.turnIndex === myPlayerIndex) {
        const hpUpdates = state.players.map((p, i) => ({ index: p.index || i, hp: Math.max(0, p.hp) }));
        callbacks.onEmitHpSync(hpUpdates);
        callbacks.onEmitActionCompleted();
      }
    }

  }, []);

  return { gameState, initWorld, updatePhysics, fireProjectile };
}
