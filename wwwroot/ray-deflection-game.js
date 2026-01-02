window.initRayDeflectionGame = (canvasId) => {
    console.log('Initializing ray deflection game with canvas:', canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.error('Canvas not found:', canvasId);
        return;
    }
    console.log('Canvas found, initializing game...');
    
    const ctx = canvas.getContext('2d', { alpha: false });
    const CANVAS_WIDTH = 640;
    const CANVAS_HEIGHT = 480;
    const resolution = 200;
    const TARGET_Y = CANVAS_HEIGHT - 40;
    const TARGET_WIDTH = 60;
    const MIRROR_LENGTH = 80;
    const MIN_RAY_SEPARATION = Math.PI / 12;
    const MIN_DISTANCE_FROM_ORIGIN = 100;
    const MIN_DISTANCE_FROM_TARGET = 80;
    
    let gameState = 'aiming';
    let centerPoint = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
    let rays = [];
    let mirror = {
        pos: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 + 100 },
        angle: 0,
        length: MIRROR_LENGTH
    };
    let targetCenter = { x: CANVAS_WIDTH / 2, y: TARGET_Y };
    let hitCount = 0;
    let solution = null;
    let holdProgress = 0;
    let isHolding = false;
    let analysisComplete = false;
    let completionTimer = 0;
    let lastFrameTime = Date.now();
    
    const generateNewLevel = () => {
        // Step 1: Randomize ray origin point
        centerPoint = {
            x: CANVAS_WIDTH / 2 + (Math.random() - 0.5) * 120,
            y: CANVAS_HEIGHT / 2 + (Math.random() - 0.5) * 100
        };
        
        // Step 2: Spawn target at random position
        const targetX = TARGET_WIDTH / 2 + 40 + Math.random() * (CANVAS_WIDTH - TARGET_WIDTH - 80);
        const targetLeft = targetX - TARGET_WIDTH / 2;
        const targetRight = targetX + TARGET_WIDTH / 2;
        targetCenter = { x: targetX, y: TARGET_Y };
        
        // Step 3: Generate rays that don't hit near target
        const numRays = 3 + Math.floor(Math.random() * 3);
        const newRays = [];
        const angles = [];
        
        const TARGET_AVOIDANCE_WIDTH = TARGET_WIDTH * 1.2;
        const avoidLeft = targetX - TARGET_AVOIDANCE_WIDTH / 2;
        const avoidRight = targetX + TARGET_AVOIDANCE_WIDTH / 2;
        
        for (let i = 0; i < numRays; i++) {
            let angle;
            let attempts = 0;
            let validAngle = false;
            
            do {
                angle = Math.random() * Math.PI * 2;
                attempts++;
                
                // Check separation from existing rays
                const hasGoodSeparation = !angles.some(existingAngle => {
                    const diff = Math.abs(((angle - existingAngle + Math.PI) % (Math.PI * 2)) - Math.PI);
                    return diff < MIN_RAY_SEPARATION;
                });
                
                if (!hasGoodSeparation) continue;
                
                // Check if ray would hit near target
                const rayDir = { x: Math.cos(angle), y: Math.sin(angle) };
                if (Math.abs(rayDir.y) > 0.0001) {
                    const t = (TARGET_Y - centerPoint.y) / rayDir.y;
                    if (t > 0) {
                        const hitX = centerPoint.x + rayDir.x * t;
                        if (hitX >= avoidLeft && hitX <= avoidRight) {
                            continue;
                        }
                    }
                }
                
                validAngle = true;
            } while (attempts < 100 && !validAngle);
            
            if (validAngle) {
                angles.push(angle);
                newRays.push({ angle: angle, origin: centerPoint });
            }
        }
        
        if (newRays.length < 3) {
            generateNewLevel();
            return;
        }
        
        rays = newRays;
        
        // Step 4: Find solution using brute force
        let foundSolution = false;
        let solutionRayIndex = 0;
        let solutionMirrorPos = { x: 0, y: 0 };
        let solutionMirrorAngle = 0;
        
        for (let attempt = 0; attempt < 5000 && !foundSolution; attempt++) {
            const testRayIndex = Math.floor(Math.random() * rays.length);
            const testRay = rays[testRayIndex];
            
            const testMirrorX = 100 + Math.random() * (CANVAS_WIDTH - 200);
            const testMirrorY = 80 + Math.random() * (TARGET_Y - MIN_DISTANCE_FROM_TARGET - 80);
            
            const distFromOrigin = Math.sqrt(
                (testMirrorX - centerPoint.x) ** 2 + 
                (testMirrorY - centerPoint.y) ** 2
            );
            if (distFromOrigin < MIN_DISTANCE_FROM_ORIGIN) continue;
            
            const distFromTarget = Math.abs(TARGET_Y - testMirrorY);
            if (distFromTarget < MIN_DISTANCE_FROM_TARGET) continue;
            
            for (let angleAttempt = 0; angleAttempt < 72; angleAttempt++) {
                const testAngle = (angleAttempt / 72) * Math.PI * 2;
                
                const rayDir = { x: Math.cos(testRay.angle), y: Math.sin(testRay.angle) };
                
                const testMirrorHalfLen = MIRROR_LENGTH / 2;
                const testMirrorStart = {
                    x: testMirrorX - Math.cos(testAngle) * testMirrorHalfLen,
                    y: testMirrorY - Math.sin(testAngle) * testMirrorHalfLen
                };
                const testMirrorEnd = {
                    x: testMirrorX + Math.cos(testAngle) * testMirrorHalfLen,
                    y: testMirrorY + Math.sin(testAngle) * testMirrorHalfLen
                };
                
                const intersection = rayLineIntersection(centerPoint, rayDir, testMirrorStart, testMirrorEnd);
                if (!intersection) continue;
                
                const testMirrorNormal = {
                    x: -Math.sin(testAngle),
                    y: Math.cos(testAngle)
                };
                
                const reflectedDir = reflect(rayDir, testMirrorNormal);
                if (reflectedDir.y <= 0.001) continue;
                
                const t = (TARGET_Y - intersection.y) / reflectedDir.y;
                if (t <= 0) continue;
                
                const hitX = intersection.x + reflectedDir.x * t;
                
                if (hitX >= targetLeft && hitX <= targetRight) {
                    foundSolution = true;
                    solutionRayIndex = testRayIndex;
                    solutionMirrorPos = { x: testMirrorX, y: testMirrorY };
                    solutionMirrorAngle = testAngle;
                    console.log(`Solution found: ray ${solutionRayIndex}, mirror at (${Math.round(testMirrorX)}, ${Math.round(testMirrorY)}), angle ${Math.round(testAngle * 180 / Math.PI)}°`);
                    break;
                }
            }
        }
        
        if (!foundSolution) {
            generateNewLevel();
            return;
        }
        
        solution = {
            mirrorPos: solutionMirrorPos,
            mirrorAngle: solutionMirrorAngle,
            rayIndex: solutionRayIndex
        };
        
        // Step 5: Spawn mirror at random position with solution angle
        const randomX = 150 + Math.random() * (CANVAS_WIDTH - 300);
        const randomY = 100 + Math.random() * (CANVAS_HEIGHT - 200);
        
        mirror = {
            pos: { x: randomX, y: randomY },
            angle: solutionMirrorAngle, // Use solution angle!
            length: MIRROR_LENGTH
        };
        
        gameState = 'aiming';
        hitCount = 0;
        holdProgress = 0;
        isHolding = false;
        analysisComplete = false;
        completionTimer = 0;
        lastFrameTime = Date.now();
    };
    
    const rayLineIntersection = (rayStart, rayDir, lineStart, lineEnd) => {
        const x1 = rayStart.x;
        const y1 = rayStart.y;
        const x2 = rayStart.x + rayDir.x * 10000;
        const y2 = rayStart.y + rayDir.y * 10000;
        
        const x3 = lineStart.x;
        const y3 = lineStart.y;
        const x4 = lineEnd.x;
        const y4 = lineEnd.y;
        
        const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (Math.abs(denom) < 0.0001) return null;
        
        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
        const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
        
        if (t > 0 && u >= 0 && u <= 1) {
            return {
                x: x1 + t * (x2 - x1),
                y: y1 + t * (y2 - y1)
            };
        }
        
        return null;
    };
    
    const reflect = (dir, normal) => {
        const dot = dir.x * normal.x + dir.y * normal.y;
        return {
            x: dir.x - 2 * dot * normal.x,
            y: dir.y - 2 * dot * normal.y
        };
    };
    
    const render = () => {
        const imageData = ctx.createImageData(resolution, resolution);
        const data = imageData.data;
        
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
            return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2) <= radius;
        };
        
        const mirrorHalfLen = mirror.length / 2;
        const mirrorStart = {
            x: mirror.pos.x - Math.cos(mirror.angle) * mirrorHalfLen,
            y: mirror.pos.y - Math.sin(mirror.angle) * mirrorHalfLen
        };
        const mirrorEnd = {
            x: mirror.pos.x + Math.cos(mirror.angle) * mirrorHalfLen,
            y: mirror.pos.y + Math.sin(mirror.angle) * mirrorHalfLen
        };
        
        const mirrorNormal = {
            x: -Math.sin(mirror.angle),
            y: Math.cos(mirror.angle)
        };
        
        const rayPaths = [];
        let currentHitCount = 0;
        
        rays.forEach(ray => {
            const rayDir = {
                x: Math.cos(ray.angle),
                y: Math.sin(ray.angle)
            };
            
            const intersection = rayLineIntersection(ray.origin, rayDir, mirrorStart, mirrorEnd);
            
            if (intersection) {
                rayPaths.push({
                    start: ray.origin,
                    end: intersection,
                    color: { r: 255, g: 255, b: 255 }
                });
                
                const reflectedDir = reflect(rayDir, mirrorNormal);
                const reflectedEnd = {
                    x: intersection.x + reflectedDir.x * 2000,
                    y: intersection.y + reflectedDir.y * 2000
                };
                
                const targetLeft = targetCenter.x - TARGET_WIDTH / 2;
                const targetRight = targetCenter.x + TARGET_WIDTH / 2;
                
                if (Math.abs(reflectedDir.y) > 0.0001) {
                    const t = (TARGET_Y - intersection.y) / reflectedDir.y;
                    if (t > 0) {
                        const hitX = intersection.x + reflectedDir.x * t;
                        if (hitX >= targetLeft && hitX <= targetRight) {
                            currentHitCount++;
                            rayPaths.push({
                                start: intersection,
                                end: { x: hitX, y: TARGET_Y },
                                color: { r: 0, g: 255, b: 0 }
                            });
                        } else {
                            rayPaths.push({
                                start: intersection,
                                end: reflectedEnd,
                                color: { r: 255, g: 255, b: 255 }
                            });
                        }
                    }
                }
            } else {
                const rayEnd = {
                    x: ray.origin.x + rayDir.x * 1000,
                    y: ray.origin.y + rayDir.y * 1000
                };
                rayPaths.push({
                    start: ray.origin,
                    end: rayEnd,
                    color: { r: 255, g: 255, b: 255 }
                });
            }
        });
        
        hitCount = currentHitCount;
        
        for (let py = 0; py < resolution; py++) {
            for (let px = 0; px < resolution; px++) {
                const worldX = (px / resolution) * CANVAS_WIDTH;
                const worldY = (py / resolution) * CANVAS_HEIGHT;
                
                let color = { r: 0, g: 0, b: 0 };
                let isDrawn = false;
                
                for (const path of rayPaths) {
                    if (isPointNearLine(worldX, worldY, path.start.x, path.start.y, path.end.x, path.end.y, 0.8)) {
                        color = path.color;
                        isDrawn = true;
                        break;
                    }
                }
                
                if (!isDrawn && isPointNearLine(worldX, worldY, mirrorStart.x, mirrorStart.y, mirrorEnd.x, mirrorEnd.y, 2)) {
                    color = { r: 255, g: 255, b: 255 };
                    isDrawn = true;
                }
                
                if (!isDrawn) {
                    for (const ray of rays) {
                        if (isPointInCircle(worldX, worldY, ray.origin.x, ray.origin.y, 3)) {
                            color = { r: 255, g: 255, b: 255 };
                            isDrawn = true;
                            break;
                        }
                    }
                }
                
                const targetLeft = targetCenter.x - TARGET_WIDTH / 2;
                const targetRight = targetCenter.x + TARGET_WIDTH / 2;
                if (!isDrawn && Math.abs(worldY - TARGET_Y) < 2 && worldX >= targetLeft && worldX <= targetRight) {
                    color = { r: 0, g: 255, b: 0 };
                    isDrawn = true;
                }
                
                if (!isDrawn && isPointInCircle(worldX, worldY, targetCenter.x, targetCenter.y, 3)) {
                    color = { r: 0, g: 255, b: 0 };
                    isDrawn = true;
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
        
        // Grid
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
        
        // Status
        ctx.fillStyle = '#00ff00';
        ctx.font = '9px monospace';
        let statusY = 25;
        
        ctx.fillStyle = '#ffff00';
        ctx.fillText('DEFLECTION PROTOCOL', 20, statusY);
        statusY += 12;
        
        ctx.fillStyle = '#00ff00';
        ctx.fillText(`RAYS: ${rays.length}`, 20, statusY);
        statusY += 12;
        
        ctx.fillText(`HITS: ${hitCount}/${rays.length}`, 20, statusY);
        statusY += 12;
        
        if (hitCount >= 1) {
            if (analysisComplete && completionTimer > 2000) {
                gameState = 'complete';
            } else {
                ctx.fillStyle = '#ffff00';
                ctx.fillText('STATUS: ANALYZING', 20, statusY);
                statusY += 12;
                
                // Progress bar background
                ctx.fillStyle = '#222222';
                ctx.fillRect(20, statusY, 180, 16);
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.strokeRect(20, statusY, 180, 16);
                
                // Ship-like progress fill
                const fillWidth = (holdProgress / 100) * 180;
                if (fillWidth > 4) {
                    // Ship main body (rectangle)
                    ctx.fillStyle = '#00ff00';
                    const bodyWidth = Math.max(0, fillWidth - 8);
                    ctx.fillRect(22, statusY + 4, bodyWidth, 8);
                    
                    // Ship nose (triangle pointing right)
                    if (fillWidth > 8) {
                        ctx.beginPath();
                        ctx.moveTo(22 + bodyWidth, statusY + 4);
                        ctx.lineTo(22 + bodyWidth, statusY + 12);
                        ctx.lineTo(20 + fillWidth, statusY + 8);
                        ctx.closePath();
                        ctx.fill();
                    }
                    
                    // Engine trails (small lines behind ship)
                    if (fillWidth > 12) {
                        ctx.fillStyle = '#00aa00';
                        ctx.fillRect(22, statusY + 2, Math.min(6, bodyWidth), 1);
                        ctx.fillRect(22, statusY + 13, Math.min(6, bodyWidth), 1);
                    }
                }
                
                // Percentage text
                ctx.fillStyle = '#ffffff';
                ctx.font = '8px monospace';
                ctx.fillText(`${Math.floor(holdProgress)}%`, 210, statusY + 11);
                statusY += 20;
            }
        } else {
            ctx.fillStyle = '#ffff00';
            ctx.fillText('STATUS: ACTIVE', 20, statusY);
            statusY += 12;
        }
        
        ctx.fillStyle = '#888888';
        ctx.font = '8px monospace';
        ctx.fillText('MOVE: Mouse', 20, statusY);
        
        // Analysis Complete Overlay
        if (analysisComplete && completionTimer <= 2000) {
            // Semi-transparent overlay
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            
            // Large message box
            const boxWidth = 400;
            const boxHeight = 120;
            const boxX = (CANVAS_WIDTH - boxWidth) / 2;
            const boxY = (CANVAS_HEIGHT - boxHeight) / 2;
            
            // Box background
            ctx.fillStyle = '#000000';
            ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
            
            // Box border
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 3;
            ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
            
            // Corner brackets
            const bracketSize = 20;
            ctx.lineWidth = 2;
            // Top-left
            ctx.beginPath();
            ctx.moveTo(boxX + bracketSize, boxY);
            ctx.lineTo(boxX, boxY);
            ctx.lineTo(boxX, boxY + bracketSize);
            ctx.stroke();
            // Top-right
            ctx.beginPath();
            ctx.moveTo(boxX + boxWidth - bracketSize, boxY);
            ctx.lineTo(boxX + boxWidth, boxY);
            ctx.lineTo(boxX + boxWidth, boxY + bracketSize);
            ctx.stroke();
            // Bottom-left
            ctx.beginPath();
            ctx.moveTo(boxX, boxY + boxHeight - bracketSize);
            ctx.lineTo(boxX, boxY + boxHeight);
            ctx.lineTo(boxX + bracketSize, boxY + boxHeight);
            ctx.stroke();
            // Bottom-right
            ctx.beginPath();
            ctx.moveTo(boxX + boxWidth - bracketSize, boxY + boxHeight);
            ctx.lineTo(boxX + boxWidth, boxY + boxHeight);
            ctx.lineTo(boxX + boxWidth, boxY + boxHeight - bracketSize);
            ctx.stroke();
            
            // Main text
            ctx.fillStyle = '#00ff00';
            ctx.font = 'bold 24px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('ANALYSIS COMPLETE', CANVAS_WIDTH / 2, boxY + 50);
            
            // Subtitle
            ctx.font = '12px monospace';
            ctx.fillStyle = '#ffffff';
            ctx.fillText('SPECTROSCOPY DATA ACQUIRED', CANVAS_WIDTH / 2, boxY + 80);
            
            // Reset text alignment
            ctx.textAlign = 'left';
        }
    };
    
    const updateProgress = () => {
        const currentTime = Date.now();
        const deltaTime = currentTime - lastFrameTime;
        lastFrameTime = currentTime;
        
        if (hitCount >= 1 && !analysisComplete) {
            isHolding = true;
            holdProgress += (deltaTime / 30); // 3 seconds to fill
            
            if (holdProgress >= 100) {
                holdProgress = 100;
                analysisComplete = true;
                completionTimer = 0;
            }
        } else if (!analysisComplete) {
            isHolding = false;
            holdProgress = Math.max(0, holdProgress - (deltaTime / 10)); // Decay when not hitting
        }
        
        if (analysisComplete) {
            completionTimer += deltaTime;
        }
        
        render();
        
        if (!analysisComplete || completionTimer <= 2000) {
            requestAnimationFrame(updateProgress);
        }
    };
    
    const handleMouseMove = (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);
        
        // Only update position, keep solution angle
        mirror.pos = { x, y };
        render();
    };
    
    canvas.addEventListener('mousemove', handleMouseMove);
    
    generateNewLevel();
    render();
    updateProgress();
    
    return {
        reset: () => {
            generateNewLevel();
            render();
            updateProgress();
        },
        isComplete: () => analysisComplete && completionTimer > 2000
    };
};