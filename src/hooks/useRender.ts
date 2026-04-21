import { useCallback } from 'react';

export function useRender(gameState: any) {
  const drawScene = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, mapType: number, gravity: number) => {
    const state = gameState.current;
    if (!state.players || state.players.length === 0) return;
    
    // 🛡️ [안전장치 1] 현재 턴인 플레이어가 유효한지 확인
    let currentTank = state.players[state.turnIndex];
    if (!currentTank || currentTank.hp <= 0) {
        // 만약 턴 인덱스가 꼬였다면 살아있는 첫 번째 플레이어라도 잡습니다.
        currentTank = state.players.find((p: any) => p.hp > 0) || state.players[0];
    }

    // 1. Camera logic
    let targetX = currentTank.x + currentTank.width / 2;
    let targetY = state.terrain[Math.floor(targetX)] || canvas.height - 200;
    let targetZoom = 1.0;

    if (state.projectiles.length > 0) {
      const p = state.projectiles[0];
      if (!isNaN(p.x) && !isNaN(p.y)) {
        targetX = p.x;
        targetY = p.y;
        const altitude = Math.max(0, (state.terrain[Math.floor(targetX)] || canvas.height) - targetY);
        targetZoom = Math.max(0.3, 1.0 - (altitude / 5000));
      }
    } else if (state.explosions.length > 0) {
      targetX = state.explosions[0].x;
      targetY = state.explosions[0].y;
      targetZoom = 1.0;
    }

    const visibleWidth = canvas.width / state.camera.zoom;
    const visibleHeight = canvas.height / state.camera.zoom;

    // 🛡️ [안전장치 2] 계산된 목표 좌표가 NaN이면 즉시 기본값으로 대체
    if (isNaN(targetX)) targetX = state.WORLD_WIDTH / 2;
    if (isNaN(targetY)) targetY = canvas.height / 2;
    if (isNaN(targetZoom) || targetZoom <= 0) targetZoom = 1.0;

    let desiredCamX = Math.max(visibleWidth / 2, Math.min(targetX, state.WORLD_WIDTH - visibleWidth / 2));
    let desiredCamY = targetY - visibleHeight * 0.2;

    // 🚀 [핵심 수정] 화면으로 돌아왔을 때 카메라가 너무 멀리 있다면 보간법(Lerp) 대신 즉시 이동(Snap)
    const dist = Math.hypot(desiredCamX - state.camera.x, desiredCamY - state.camera.y);
    if (dist > 5000 || isNaN(state.camera.x)) {
        state.camera.x = desiredCamX;
        state.camera.y = desiredCamY;
    } else {
        state.camera.x += (desiredCamX - state.camera.x) * 0.1;
        state.camera.y += (desiredCamY - state.camera.y) * 0.1;
    }
    
    state.camera.zoom += (targetZoom - state.camera.zoom) * 0.05;

    // 2. Setup Canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(state.camera.zoom, state.camera.zoom);
    ctx.translate(-state.camera.x, -state.camera.y);

    const buffer = 500;
    const MathFloor = Math.floor;
    const visibleLeft = Math.max(0, MathFloor(state.camera.x - visibleWidth / 2 - buffer));
    const visibleRight = Math.min(state.WORLD_WIDTH, Math.ceil(state.camera.x + visibleWidth / 2 + buffer));

    // 3. Draw Clouds
    state.clouds.forEach((cloud: any) => {
      cloud.x += state.wind * 0.01 * cloud.speedFactor;
      if (cloud.x > state.WORLD_WIDTH + cloud.width) cloud.x = -cloud.width;
      if (cloud.x < -cloud.width) cloud.x = state.WORLD_WIDTH + cloud.width;
      if (cloud.x > visibleLeft - cloud.width && cloud.x < visibleRight + cloud.width) {
        ctx.beginPath();
        ctx.ellipse(cloud.x, cloud.y, cloud.width / 2, cloud.height / 2, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${cloud.opacity})`;
        ctx.fill();
      }
    });

    // 4. Draw Terrain
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.moveTo(visibleLeft, canvas.height + 3000);
    for (let x = visibleLeft; x < visibleRight; x++) ctx.lineTo(x, state.terrain[x]);
    ctx.lineTo(visibleRight, canvas.height + 3000);
    ctx.closePath();
    ctx.fill();

    // 5. Draw Buildings (Map 1)
    if (mapType === 1) {
      state.buildings.forEach((b: any) => {
        if (b.right > visibleLeft && b.left < visibleRight) {
          const startX = Math.max(MathFloor(b.left), visibleLeft);
          const endX = Math.min(MathFloor(b.right), visibleRight);

          ctx.fillStyle = '#64748b';
          ctx.beginPath();
          ctx.moveTo(startX, canvas.height + 3000);
          for (let x = startX; x <= endX; x++) ctx.lineTo(x, state.terrain[x]);
          ctx.lineTo(endX, canvas.height + 3000);
          ctx.closePath();
          ctx.fill();

          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 3;
          ctx.beginPath();
          for (let x = startX; x <= endX; x++) ctx.lineTo(x, state.terrain[x]);
          ctx.stroke();

          if (b.right - b.left > 80) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.lineWidth = 8;
            ctx.beginPath();
            for (let wx = b.left + 30; wx < b.right; wx += 40) {
              if (wx > visibleLeft && wx < visibleRight) {
                ctx.moveTo(wx, state.terrain[MathFloor(wx)] + 15);
                ctx.lineTo(wx, canvas.height + 3000);
              }
            }
            ctx.stroke();
          }
        }
      });
    }

    // 6. Draw Last Trails
    if (!state.isTurnActive) {
      Object.keys(state.lastTrails).forEach((id) => {
        const idx = parseInt(id);
        const trail = state.lastTrails[idx];
        if (!trail || trail.length < 2) return;

        // 🎨 내 턴일 때 내 궤적은 점선으로 선명하게, 남의 궤적은 아주 흐리게
        ctx.beginPath();
        ctx.setLineDash([5, 5]); // 점선 효과
        ctx.strokeStyle = idx === state.turnIndex 
            ? 'rgba(255, 255, 255, 0.8)' 
            : 'rgba(255, 255, 255, 0.1)'; 
        
        ctx.moveTo(trail[0].x, trail[0].y);
        for (let j = 1; j < trail.length; j++) {
            ctx.lineTo(trail[j].x, trail[j].y);
        }
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.setLineDash([]); // 점선 해제
      });
    }

    // 7. Draw Duds
    state.duds.forEach((dud: any) => {
      ctx.beginPath();
      ctx.arc(dud.x, dud.y - 3, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#4b5563';
      ctx.fill();
      if (MathFloor(Date.now() / 200) % 2 === 0) {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath(); ctx.arc(dud.x, dud.y - 5, 2, 0, Math.PI * 2); ctx.fill();
      }
    });

    // 8. Draw Fires
    state.fires.forEach((fire: any) => {
      ctx.beginPath();
      const flickerRadius = fire.radius + (Math.random() * 8 - 4);
      ctx.arc(fire.x, fire.y, flickerRadius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(45, 212, 191, ${0.4 + Math.random() * 0.3})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(fire.x, fire.y, flickerRadius * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(204, 251, 241, ${0.6 + Math.random() * 0.4})`;
      ctx.fill();
    });

    // 9. Draw Players
    state.players.forEach((tank: any, idx: number) => {
      if (tank.hp <= 0) return;

      const cx = tank.x + tank.width / 2;
      const cy = state.terrain[MathFloor(cx)] || canvas.height - 200;
      const x1 = Math.max(0, MathFloor(cx - 20));
      const x2 = Math.min(state.WORLD_WIDTH - 1, MathFloor(cx + 20));
      const tankAngle = Math.atan2((state.terrain[x2]||0) - (state.terrain[x1]||0), x2 - x1);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(tankAngle);

      ctx.fillStyle = tank.color;
      ctx.fillRect(-tank.width / 2, -tank.height, tank.width, tank.height);
      ctx.beginPath();
      ctx.arc(0, -tank.height, 15, Math.PI, 0);
      ctx.fill();

      if (tank.dots.length > 0) {
        ctx.fillStyle = `rgba(45, 212, 191, ${0.5 + Math.random() * 0.5})`;
        ctx.beginPath();
        ctx.arc(-10 + Math.random() * 20, -tank.height - 10 - Math.random() * 15, 3 + Math.random() * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      const turretBaseX = cx + (tank.height + 5) * Math.sin(tankAngle);
      const turretBaseY = cy - (tank.height + 5) * Math.cos(tankAngle);
      const radian = (tank.angle * Math.PI) / 180;
      const trueRadian = tank.direction === 1 ? radian : Math.PI - radian;
      const endX = turretBaseX + Math.cos(trueRadian) * 40;
      const endY = turretBaseY - Math.sin(trueRadian) * 40;

      if (state.isPreviewing && idx === state.turnIndex) {
        let pX = endX, pY = endY;
        let pVx = Math.cos(trueRadian) * tank.power * 0.4;
        let pVy = -Math.sin(trueRadian) * tank.power * 0.4;
        ctx.beginPath(); ctx.moveTo(pX, pY);
        for (let t = 0; t < 60; t++) {
          pVx += state.wind * 0.001; pVy += gravity; pX += pVx; pY += pVy;
          ctx.lineTo(pX, pY);
          if (state.terrain[MathFloor(pX)] && pY >= state.terrain[MathFloor(pX)]) break;
        }
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'; ctx.setLineDash([10, 10]); ctx.stroke(); ctx.setLineDash([]);
      }

      ctx.beginPath();
      ctx.moveTo(turretBaseX, turretBaseY); ctx.lineTo(endX, endY);
      ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.strokeStyle = '#333333'; ctx.stroke();
    });

    // 10. Draw Explosions
    state.explosions.forEach((exp: any) => {
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
      if (exp.weaponType === 0) ctx.fillStyle = `rgba(239, 68, 68, ${exp.alpha})`; // 빨강
      else if (exp.weaponType === 1) ctx.fillStyle = `rgba(249, 115, 22, ${exp.alpha})`; // 주황
      else if (exp.weaponType === 2) ctx.fillStyle = `rgba(204, 251, 241, ${exp.alpha})`; // 청백색
      else if (exp.weaponType === 3) ctx.fillStyle = `rgba(236, 72, 153, ${exp.alpha})`; // 핫핑크 (바운스)
      else if (exp.weaponType === 4) ctx.fillStyle = `rgba(168, 85, 247, ${exp.alpha})`; // 보라 (텔레포트)
      else if (exp.weaponType === 5) ctx.fillStyle = `rgba(99, 102, 241, ${exp.alpha})`; // 남색 (유도탄)
      else if (exp.weaponType === 6) ctx.fillStyle = `rgba(253, 224, 71, ${exp.alpha})`; // 노랑 (에어버스트)
      ctx.fill();

      ctx.beginPath();
      ctx.arc(exp.x, exp.y, exp.radius * 0.6, 0, Math.PI * 2);
      if (exp.weaponType === 0) ctx.fillStyle = `rgba(250, 204, 21, ${exp.alpha})`;
      else if (exp.weaponType === 1) ctx.fillStyle = `rgba(234, 179, 8, ${exp.alpha})`;
      else if (exp.weaponType === 2) ctx.fillStyle = `rgba(45, 212, 191, ${exp.alpha})`;
      else if (exp.weaponType === 3) ctx.fillStyle = `rgba(253, 164, 175, ${exp.alpha})`; // 연핑크
      else if (exp.weaponType === 4) ctx.fillStyle = `rgba(216, 180, 254, ${exp.alpha})`; // 연보라
      else if (exp.weaponType === 5) ctx.fillStyle = `rgba(165, 180, 252, ${exp.alpha})`; // 연남색
      else if (exp.weaponType === 6) ctx.fillStyle = `rgba(255, 255, 255, ${exp.alpha})`; // 섬광 화이트
      ctx.fill();
    });

    // 11. Draw Projectiles
    state.projectiles.forEach((p: any) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.splitStage > 0 ? 4 : 6, 0, Math.PI * 2);
      if (p.isDud) { ctx.fillStyle = '#4b5563'; ctx.strokeStyle = '#1f2937'; }
      else if (p.weaponType === 0) { ctx.fillStyle = '#ef4444'; ctx.strokeStyle = '#991b1b'; }
      else if (p.weaponType === 1) { ctx.fillStyle = '#f97316'; ctx.strokeStyle = '#c2410c'; }
      else if (p.weaponType === 2) { ctx.fillStyle = '#ccfbf1'; ctx.strokeStyle = '#0f766e'; }
      else if (p.weaponType === 3) { ctx.fillStyle = '#f472b6'; ctx.strokeStyle = '#be185d'; }
      else if (p.weaponType === 4) { ctx.fillStyle = '#d8b4fe'; ctx.strokeStyle = '#7e22ce'; }
      else if (p.weaponType === 5) { ctx.fillStyle = '#a5b4fc'; ctx.strokeStyle = '#4338ca'; }
      else if (p.weaponType === 6) { ctx.fillStyle = '#fde047'; ctx.strokeStyle = '#a16207'; }
      ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
    });

    ctx.restore();

    // 12. Draw Minimap (Fixed UI overlay)
    const mapW = 300, mapH = 90, mapX = canvas.width - mapW - 20, mapY = 20, skyHeight = 3000, worldH = canvas.height + skyHeight;
    const getMapY = (worldY: number) => mapY + ((worldY + skyHeight) / worldH) * mapH;
    
    ctx.save();
    ctx.beginPath(); ctx.rect(mapX, mapY, mapW, mapH); ctx.clip();
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(mapX, mapY, mapW, mapH);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(mapX, mapY, mapW, mapH);

    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.moveTo(mapX, getMapY(canvas.height + 3000));
    for (let i = 0; i <= mapW; i++) {
        const tIndex = Math.min(MathFloor(i * (state.WORLD_WIDTH / mapW)), state.WORLD_WIDTH - 1);
        ctx.lineTo(mapX + i, getMapY(state.terrain[tIndex] || canvas.height));
    }
    ctx.lineTo(mapX + mapW, getMapY(canvas.height + 3000));
    ctx.fill();

    if (mapType === 1) {
      ctx.fillStyle = '#64748b';
      state.buildings.forEach((b: any) => {
        const bLeft = mapX + (b.left / state.WORLD_WIDTH) * mapW;
        const bWidth = ((b.right - b.left) / state.WORLD_WIDTH) * mapW;
        const bY = getMapY(state.terrain[MathFloor((b.left + b.right) / 2)] || canvas.height);
        ctx.fillRect(bLeft, bY, bWidth, mapH);
      });
    }

    const viewW = (canvas.width / state.camera.zoom / state.WORLD_WIDTH) * mapW;
    const viewH = (canvas.height / state.camera.zoom / worldH) * mapH;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 1.5;
    const viewX = mapX + (Math.max(0, state.camera.x - canvas.width / state.camera.zoom / 2) / state.WORLD_WIDTH) * mapW;
    const viewY = getMapY(state.camera.y - canvas.height / state.camera.zoom / 2);
    ctx.strokeRect(viewX, viewY, viewW, viewH);

    state.players.forEach((t: any) => {
        if (t.hp <= 0) return;
        ctx.fillStyle = t.color;
        ctx.beginPath();
        const pX = mapX + (t.x / state.WORLD_WIDTH) * mapW;
        const pTerrain = state.terrain[MathFloor(t.x)] || canvas.height;
        ctx.arc(pX, getMapY(pTerrain), 3, 0, Math.PI * 2);
        ctx.fill();
    });

    ctx.fillStyle = '#ef4444';
    state.projectiles.forEach((p: any) => {
        ctx.beginPath();
        ctx.arc(mapX + (p.x / state.WORLD_WIDTH) * mapW, getMapY(p.y), 2.5, 0, Math.PI * 2);
        ctx.fill();
    });

    const mapTrail = state.lastTrails[state.turnIndex];
    if (mapTrail && mapTrail.length > 1 && !state.isTurnActive) {
      ctx.beginPath();
      ctx.moveTo(mapX + (mapTrail[0].x / state.WORLD_WIDTH) * mapW, getMapY(mapTrail[0].y));
      for (let j = 1; j < mapTrail.length; j++) {
        ctx.lineTo(mapX + (mapTrail[j].x / state.WORLD_WIDTH) * mapW, getMapY(mapTrail[j].y));
      }
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();

  }, [gameState]);

  return { drawScene };
}
