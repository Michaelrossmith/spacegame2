window.initOrbitGame = (canvasId) => {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d', { alpha: false });
    const CANVAS_WIDTH = 640;
    const CANVAS_HEIGHT = 480;
    const resolution = 200;
    
    let gameState = 'idle';
    let planet = { x: 400, y: 300 };
    let probe = { pos: { x: 200, y: 150 }, vel: { x: 0, y: 0 } };
    let obstacles = [];
    let mousePos = { x: 0, y: 0 };
    let trajectory = [];
    let willCrash = false;
    let willEscape = false;
    let launchSpeed = 0;
    
    const planetRadius = 40;
    const planetMass = 15000;
    const obstacleMass = 80;
    const minSpeed = 0.5;
    const maxSpeed = 3.5;
    const speedScale = 0.02;
    const gravityMultiplier = 0.1;
    
    let animationFrame;
    let orbitCheck = { angle: 0, startAngle: null, totalRotation: 0 };
    let missionStartTime = 0;
    
    const resetGame = () => {
        planet = { 
            x: CANVAS_WIDTH / 2 + (Math.random() - 0.5) * 150, 
            y: CANVAS_HEIGHT / 2 + (Math.random() - 0.5) * 150 
        };
        
        const angle = Math.random() * Math.PI * 2;
        const distance = 150 + Math.random() * 120;
        let newProbeX = planet.x + Math.cos(angle) * distance;
        let newProbeY = planet.y + Math.sin(angle) * distance;
        
        newProbeX = Math.max(10, Math.min(CANVAS_WIDTH - 10, newProbeX));
        newProbeY = Math.max(10, Math.min(CANVAS_HEIGHT - 10, newProbeY));
        
        probe = { pos: { x: newProbeX, y: newProbeY }, vel: { x: 0, y: 0 } };
        
        const numObstacles = 2 + Math.floor(Math.random() * 3);
        obstacles = [];
        
        for (let i = 0; i < numObstacles; i++) {
            let obstaclePos;
            let attempts = 0;
            
            do {
                const obstacleAngle = Math.random() * Math.PI * 2;
                const obstacleDistance = 120 + Math.random() * 200;
                obstaclePos = {
                    x: planet.x + Math.cos(obstacleAngle) * obstacleDistance,
                    y: planet.y + Math.sin(obstacleAngle) * obstacleDistance
                };
                attempts++;
            } while (
                attempts < 20 &&
                (Math.sqrt((obstaclePos.x - probe.pos.x) ** 2 + (obstaclePos.y - probe.pos.y) ** 2) < 80 ||
                 obstaclePos.x < 50 || obstaclePos.x > CANVAS_WIDTH - 50 ||
                 obstaclePos.y < 50 || obstaclePos.y > CANVAS_HEIGHT - 50)
            );
            
            const radius = 15 + Math.random() * 20;
            obstacles.push({
                pos: obstaclePos,
                radius: radius,
                mass: radius * obstacleMass
            });
        }
        
        gameState = 'idle';
        trajectory = [];
        launchSpeed = 0;
        orbitCheck = { angle: 0, startAngle: null, totalRotation: 0 };
    };
    
    const calculateGravity = (pos, planetPos, obstacles) => {
        let totalForceX = 0;
        let totalForceY = 0;
        
        const dx = planetPos.x - pos.x;
        const dy = planetPos.y - pos.y;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq);
        
        if (dist > 1) {
            const force = planetMass / distSq;
            totalForceX += (dx / dist) * force;
            totalForceY += (dy / dist) * force;
        }
        
        for (const obstacle of obstacles) {
            const odx = obstacle.pos.x - pos.x;
            const ody = obstacle.pos.y - pos.y;
            const oDistSq = odx * odx + ody * ody;
            const oDist = Math.sqrt(oDistSq);
            
            if (oDist > 1) {
                const oForce = obstacle.mass / oDistSq;
                totalForceX += (odx / oDist) * oForce;
                totalForceY += (ody / oDist) * oForce;
            }
        }
        
        return { x: totalForceX, y: totalForceY };
    };
    
    const simulateTrajectory = (startPos, startVel) => {
        const path = [{ ...startPos }];
        let pos = { ...startPos };
        let vel = { ...startVel };
        let crash = false;
        let escape = false;
        let totalRotation = 0;
        let lastAngle = Math.atan2(startPos.y - planet.y, startPos.x - planet.x);
        
        for (let i = 0; i < 2000; i++) {
            const gravity = calculateGravity(pos, planet, obstacles);
            vel.x += gravity.x * gravityMultiplier;
            vel.y += gravity.y * gravityMultiplier;
            
            pos.x += vel.x;
            pos.y += vel.y;
            
            const distToPlanet = Math.sqrt((pos.x - planet.x) ** 2 + (pos.y - planet.y) ** 2);
            
            if (distToPlanet < planetRadius) {
                crash = true;
                break;
            }
            
            for (const obstacle of obstacles) {
                const distToObstacle = Math.sqrt((pos.x - obstacle.pos.x) ** 2 + (pos.y - obstacle.pos.y) ** 2);
                if (distToObstacle < obstacle.radius) {
                    crash = true;
                    break;
                }
            }
            
            if (crash) break;
            
            const currentAngle = Math.atan2(pos.y - planet.y, pos.x - planet.x);
            let angleDiff = currentAngle - lastAngle;
            
            if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
            
            totalRotation += angleDiff;
            lastAngle = currentAngle;
            
            if (Math.abs(totalRotation) >= Math.PI * 2) {
                crash = false;
                break;
            }
            
            if (pos.x < -200 || pos.x > CANVAS_WIDTH + 200 || pos.y < -200 || pos.y > CANVAS_HEIGHT + 200) {
                escape = true;
                break;
            }
            
            if (i % 3 === 0) {
                path.push({ ...pos });
            }
        }
        
        return { path, crash, escape };
    };
    
    const isPointNearLine = (px, py, x1, y1, x2, y2, threshold = 0.5) => {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lengthSq = dx * dx + dy * dy;
        if (lengthSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2) <= threshold;
        
        let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
        t = Math.max(0, Math.min(1, t));
        
        const nearestX = x1 + t * dx;
        const nearestY = y1 + t * dy;
        const dist = Math.sqrt((px - nearestX) ** 2 + (py - nearestY) ** 2);
        
        return dist <= threshold;
    };
    
    const isPointInCircle = (px, py, cx, cy, radius) => {
        const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
        return dist <= radius;
    };
    
    const isPointOnCircleEdge = (px, py, cx, cy, radius, thickness = 1) => {
        const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
        return Math.abs(dist - radius) <= thickness;
    };
    
    const render = () => {
        const imageData = ctx.createImageData(resolution, resolution);
        const data = imageData.data;
        
        const orbitProgress = gameState === 'launching' || gameState === 'orbiting' 
            ? Math.min(1, Math.abs(orbitCheck.totalRotation) / (Math.PI * 2))
            : 0;
        
        for (let py = 0; py < resolution; py++) {
            for (let px = 0; px < resolution; px++) {
                const worldX = (px / resolution) * CANVAS_WIDTH;
                const worldY = (py / resolution) * CANVAS_HEIGHT;
                
                let color = { r: 0, g: 0, b: 0 };
                
                // Orbit progress fill
                if ((gameState === 'launching' || gameState === 'orbiting') && orbitProgress > 0) {
                    const dx = worldX - planet.x;
                    const dy = worldY - planet.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist < planetRadius - 2) {
                        const angle = Math.atan2(dy, dx);
                        let normalizedAngle = angle < 0 ? angle + Math.PI * 2 : angle;
                        
                        const startAngle = orbitCheck.startAngle || 0;
                        let normalizedStartAngle = startAngle < 0 ? startAngle + Math.PI * 2 : startAngle;
                        
                        const targetAngle = normalizedStartAngle + (orbitCheck.totalRotation >= 0 ? orbitProgress * Math.PI * 2 : -orbitProgress * Math.PI * 2);
                        
                        let shouldFill = false;
                        if (orbitCheck.totalRotation >= 0) {
                            if (targetAngle <= Math.PI * 2) {
                                shouldFill = normalizedAngle >= normalizedStartAngle && normalizedAngle <= targetAngle;
                            } else {
                                shouldFill = normalizedAngle >= normalizedStartAngle || normalizedAngle <= (targetAngle - Math.PI * 2);
                            }
                        } else {
                            const targetAngleNeg = normalizedStartAngle - orbitProgress * Math.PI * 2;
                            if (targetAngleNeg >= 0) {
                                shouldFill = normalizedAngle <= normalizedStartAngle && normalizedAngle >= targetAngleNeg;
                            } else {
                                shouldFill = normalizedAngle <= normalizedStartAngle || normalizedAngle >= (Math.PI * 2 + targetAngleNeg);
                            }
                        }
                        
                        if (shouldFill) {
                            color = { r: 255, g: 255, b: 255 };
                        }
                    }
                }
                
                // Trajectory lines
                if (gameState === 'aiming' && trajectory.length > 1 && color.r === 0) {
                    for (let i = 0; i < trajectory.length - 1; i++) {
                        if (isPointNearLine(worldX, worldY, trajectory[i].x, trajectory[i].y, trajectory[i + 1].x, trajectory[i + 1].y, 1.5)) {
                            if (willCrash) {
                                color = { r: 255, g: 0, b: 0 };
                            } else if (willEscape) {
                                color = { r: 128, g: 128, b: 128 };
                            } else {
                                color = { r: 0, g: 255, b: 0 };
                            }
                            break;
                        }
                    }
                    
                    if (color.r === 0 && isPointNearLine(worldX, worldY, probe.pos.x, probe.pos.y, mousePos.x, mousePos.y, 0.8)) {
                        color = { r: 100, g: 100, b: 100 };
                    }
                }
                
                // Obstacles
                if (color.r === 0) {
                    for (const obstacle of obstacles) {
                        if (isPointOnCircleEdge(worldX, worldY, obstacle.pos.x, obstacle.pos.y, obstacle.radius, 2)) {
                            color = { r: 128, g: 128, b: 128 };
                            break;
                        }
                        
                        const xSize = 5;
                        if (isPointNearLine(worldX, worldY, obstacle.pos.x - xSize, obstacle.pos.y - xSize, obstacle.pos.x + xSize, obstacle.pos.y + xSize, 0.8) ||
                            isPointNearLine(worldX, worldY, obstacle.pos.x + xSize, obstacle.pos.y - xSize, obstacle.pos.x - xSize, obstacle.pos.y + xSize, 0.8)) {
                            color = { r: 100, g: 100, b: 100 };
                            break;
                        }
                    }
                }
                
                // Planet
                if (color.r === 0 && isPointOnCircleEdge(worldX, worldY, planet.x, planet.y, planetRadius, 2)) {
                    color = { r: 255, g: 255, b: 255 };
                }
                
                // Probe
                if (color.r === 0 && isPointInCircle(worldX, worldY, probe.pos.x, probe.pos.y, 6)) {
                    color = { r: 255, g: 255, b: 255 };
                }
                
                const index = (py * resolution + px) * 4;
                data[index] = color.r;
                data[index + 1] = color.g;
                data[index + 2] = color.b;
                data[index + 3] = 255;
            }
        }
        
        const offCanvas = document.createElement('canvas');
        offCanvas.width = resolution;
        offCanvas.height = resolution;
        const offCtx = offCanvas.getContext('2d');
        offCtx.putImageData(imageData, 0, 0);
        
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.drawImage(offCanvas, 0, 0, resolution, resolution, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        // HUD overlay
        ctx.strokeStyle = '#00ff00';
        ctx.fillStyle = '#00ff00';
        ctx.lineWidth = 1;
        ctx.font = '10px monospace';
        
        // Grid lines
        ctx.globalAlpha = 0.15;
        ctx.beginPath();
        for (let x = 0; x <= CANVAS_WIDTH; x += 40) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, CANVAS_HEIGHT);
        }
        for (let y = 0; y <= CANVAS_HEIGHT; y += 40) {
            ctx.moveTo(0, y);
            ctx.lineTo(CANVAS_WIDTH, y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
        
        // Status display
        ctx.fillStyle = '#00ff00';
        ctx.font = '9px monospace';
        let statusY = 25;
        
        if (gameState === 'idle') {
            ctx.fillStyle = '#ffff00';
            ctx.fillText('STATUS: STANDBY', 20, statusY);
            statusY += 12;
            ctx.fillStyle = '#00ff00';
            ctx.fillText('[CLICK TO ENGAGE]', 20, statusY);
        } else if (gameState === 'aiming') {
            ctx.fillStyle = '#ffff00';
            ctx.fillText('STATUS: TARGETING', 20, statusY);
            statusY += 12;
            ctx.fillStyle = '#00ff00';
            ctx.fillText(`LAUNCH VEL: ${launchSpeed.toFixed(2)} U/S`, 20, statusY);
            statusY += 12;
            
            if (willCrash) {
                ctx.fillStyle = '#ff0000';
                ctx.fillText('ALERT: COLLISION', 20, statusY);
            } else if (willEscape) {
                ctx.fillStyle = '#ff8800';
                ctx.fillText('WARN: ESCAPE VECTOR', 20, statusY);
            } else {
                ctx.fillStyle = '#00ff00';
                ctx.fillText('TRAJ: NOMINAL', 20, statusY);
            }
        } else if (gameState === 'launching') {
            ctx.fillStyle = '#00ff00';
            ctx.fillText('STATUS: IN FLIGHT', 20, statusY);
            statusY += 12;
            
            const missionTime = (performance.now() - missionStartTime) / 1000;
            ctx.fillText(`TIME: ${missionTime.toFixed(2)}s`, 20, statusY);
            statusY += 12;
            
            const velocity = Math.sqrt(probe.vel.x ** 2 + probe.vel.y ** 2);
            ctx.fillText(`VEL: ${velocity.toFixed(2)} U/S`, 20, statusY);
            statusY += 12;
            
            const orbitPct = (orbitProgress * 100).toFixed(0);
            ctx.fillText(`ORBIT: ${orbitPct}%`, 20, statusY);
        } else if (gameState === 'orbiting') {
            ctx.fillStyle = '#00ff00';
            ctx.fillText('STATUS: ORBIT STABLE', 20, statusY);
            statusY += 12;
            ctx.fillText('MISSION: SUCCESS', 20, statusY);
        } else if (gameState === 'failed') {
            ctx.fillStyle = '#ff0000';
            ctx.fillText('STATUS: MISSION FAIL', 20, statusY);
            statusY += 12;
            ctx.fillText('[CLICK TO RETRY]', 20, statusY);
        }
    };
    
    const animate = () => {
        if (gameState === 'launching') {
            const gravity = calculateGravity(probe.pos, planet, obstacles);
            probe.vel.x += gravity.x * gravityMultiplier;
            probe.vel.y += gravity.y * gravityMultiplier;
            probe.pos.x += probe.vel.x;
            probe.pos.y += probe.vel.y;
            
            const distToPlanet = Math.sqrt((probe.pos.x - planet.x) ** 2 + (probe.pos.y - planet.y) ** 2);
            
            if (distToPlanet < planetRadius) {
                gameState = 'failed';
                render();
                return;
            }
            
            for (const obstacle of obstacles) {
                const distToObstacle = Math.sqrt((probe.pos.x - obstacle.pos.x) ** 2 + (probe.pos.y - obstacle.pos.y) ** 2);
                if (distToObstacle < obstacle.radius) {
                    gameState = 'failed';
                    render();
                    return;
                }
            }
            
            const currentAngle = Math.atan2(probe.pos.y - planet.y, probe.pos.x - planet.x);
            
            if (orbitCheck.startAngle === null) {
                orbitCheck.startAngle = currentAngle;
                orbitCheck.angle = currentAngle;
            } else {
                let angleDiff = currentAngle - orbitCheck.angle;
                
                if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
                
                orbitCheck.totalRotation += angleDiff;
                orbitCheck.angle = currentAngle;
                
                if (Math.abs(orbitCheck.totalRotation) >= Math.PI * 2) {
                    gameState = 'orbiting';
                    render();
                    return;
                }
            }
        }
        
        render();
        
        if (gameState === 'launching') {
            animationFrame = requestAnimationFrame(animate);
        }
    };
    
    const handleMouseMove = (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);
        mousePos = { x, y };
        
        if (gameState === 'aiming') {
            const dx = x - probe.pos.x;
            const dy = y - probe.pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist > 0) {
                const speed = Math.min(maxSpeed, Math.max(minSpeed, dist * speedScale));
                launchSpeed = speed;
                
                const velX = (dx / dist) * speed;
                const velY = (dy / dist) * speed;
                
                const result = simulateTrajectory(probe.pos, { x: velX, y: velY });
                trajectory = result.path;
                willCrash = result.crash;
                willEscape = result.escape;
                
                render();
            }
        }
    };
    
    const handleClick = (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);
        
        if (gameState === 'idle') {
            gameState = 'aiming';
            render();
        } else if (gameState === 'aiming') {
            const dx = x - probe.pos.x;
            const dy = y - probe.pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist > 0) {
                const speed = Math.min(maxSpeed, Math.max(minSpeed, dist * speedScale));
                const velX = (dx / dist) * speed;
                const velY = (dy / dist) * speed;
                
                probe.vel = { x: velX, y: velY };
                gameState = 'launching';
                missionStartTime = performance.now();
                orbitCheck = { angle: 0, startAngle: null, totalRotation: 0 };
                
                animate();
            }
        } else if (gameState === 'failed' || gameState === 'orbiting') {
            resetGame();
            render();
        }
    };
    
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);
    
    resetGame();
    render();
    
    return {
        reset: () => {
            resetGame();
            render();
        },
        getGameState: () => gameState,
        isSuccess: () => gameState === 'orbiting'
    };
};