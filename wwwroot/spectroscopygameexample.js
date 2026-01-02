import { useEffect, useRef, useState } from 'react';

interface Vector2 {
  x: number;
  y: number;
}

interface Ray {
  angle: number;
  reflected: boolean;
  origin: Vector2;
}

interface Mirror {
  pos: Vector2;
  angle: number;
  length: number;
}

interface Solution {
  mirrorPos: Vector2;
  mirrorAngle: number;
  rayIndex: number;
}

interface Target {
  x: number;
  width: number;
}

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;
const TARGET_Y = CANVAS_HEIGHT - 40;
const TARGET_WIDTH = 60;
const MIRROR_LENGTH = 80;
const MIRROR_ANGLE = Math.PI / 4; // 45 degrees
const ROTATION_STEP = Math.PI / 36; // 5 degrees
const MIN_RAY_SEPARATION = Math.PI / 12; // Minimum 15 degrees between rays

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [resolution, setResolution] = useState(200);
  const [centerPoint, setCenterPoint] = useState<Vector2>({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 });
  const [rays, setRays] = useState<Ray[]>([]);
  const [mirror, setMirror] = useState<Mirror>({
    pos: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 + 100 },
    angle: 0,
    length: MIRROR_LENGTH
  });
  const [mousePos, setMousePos] = useState<Vector2>({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 });
  const [targetCenter, setTargetCenter] = useState<Vector2>({ x: CANVAS_WIDTH / 2, y: TARGET_Y });
  const [hitCount, setHitCount] = useState(0);
  const [solution, setSolution] = useState<Solution | null>(null);
  const [isSolved, setIsSolved] = useState(false);
  const [mirrorPlaced, setMirrorPlaced] = useState(false);
  const solveTimeoutRef = useRef<number>();

  // Initialize rays
  useEffect(() => {
    generateNewLevel();
  }, []);

  // Auto-advance to next level when solved
  useEffect(() => {
    if (isSolved) {
      // Clear any existing timeout
      if (solveTimeoutRef.current) {
        clearTimeout(solveTimeoutRef.current);
      }
      
      // Generate new level after 2 seconds
      solveTimeoutRef.current = window.setTimeout(() => {
        generateNewLevel();
      }, 2000);
    }
    
    return () => {
      if (solveTimeoutRef.current) {
        clearTimeout(solveTimeoutRef.current);
      }
    };
  }, [isSolved]);

  const generateNewLevel = () => {
    // Step 1: Randomize ray origin point (stay closer to center)
    const newCenterPoint = {
      x: CANVAS_WIDTH / 2 + (Math.random() - 0.5) * 120,
      y: CANVAS_HEIGHT / 2 + (Math.random() - 0.5) * 100
    };
    setCenterPoint(newCenterPoint);
    
    // Step 2: Spawn the goal bar at a random position along the bottom
    const targetX = TARGET_WIDTH / 2 + 40 + Math.random() * (CANVAS_WIDTH - TARGET_WIDTH - 80);
    const targetLeft = targetX - TARGET_WIDTH / 2;
    const targetRight = targetX + TARGET_WIDTH / 2;
    setTargetCenter({ x: targetX, y: TARGET_Y });
    
    // Step 3: Generate random rays with minimum separation and ensure they don't hit near target
    const numRays = 3 + Math.floor(Math.random() * 5); // 3-7 rays
    const newRays: Ray[] = [];
    const angles: number[] = [];
    
    const TARGET_AVOIDANCE_WIDTH = TARGET_WIDTH * 1.2; // 20% larger on each side
    const avoidLeft = targetX - TARGET_AVOIDANCE_WIDTH / 2;
    const avoidRight = targetX + TARGET_AVOIDANCE_WIDTH / 2;
    
    for (let i = 0; i < numRays; i++) {
      let angle;
      let innerAttempts = 0;
      let validAngle = false;
      
      do {
        angle = Math.random() * Math.PI * 2;
        innerAttempts++;
        
        // Check minimum separation from existing rays
        const hasGoodSeparation = !angles.some(existingAngle => {
          const diff = Math.abs(((angle - existingAngle + Math.PI) % (Math.PI * 2)) - Math.PI);
          return diff < MIN_RAY_SEPARATION;
        });
        
        if (!hasGoodSeparation) continue;
        
        // Check if this ray would hit near the target area
        const rayDir = {
          x: Math.cos(angle),
          y: Math.sin(angle)
        };
        
        // Calculate where ray crosses TARGET_Y
        if (Math.abs(rayDir.y) > 0.0001) {
          const t = (TARGET_Y - newCenterPoint.y) / rayDir.y;
          if (t > 0) {
            const hitX = newCenterPoint.x + rayDir.x * t;
            // Ray should NOT hit within avoidance zone
            if (hitX >= avoidLeft && hitX <= avoidRight) {
              continue; // This ray is too close to target, try again
            }
          }
        }
        
        // This angle is valid!
        validAngle = true;
        
      } while (innerAttempts < 100 && !validAngle);
      
      if (validAngle && angle !== undefined) {
        angles.push(angle);
        newRays.push({
          angle: angle,
          reflected: false,
          origin: newCenterPoint
        });
      }
    }
    
    // Make sure we have at least 3 rays
    if (newRays.length < 3) {
      console.warn('Not enough valid rays, retrying...');
      generateNewLevel();
      return;
    }
    
    // Step 4: Brute force search for a working solution
    let foundSolution = false;
    let solutionRayIndex = 0;
    let solutionMirrorPos = { x: 0, y: 0 };
    let solutionMirrorAngle = 0;
    
    const MIN_DISTANCE_FROM_ORIGIN = 100; // Mirror must be at least 100px from origin
    const MIN_DISTANCE_FROM_TARGET = 80; // Mirror must be at least 80px above target
    
    for (let attempt = 0; attempt < 5000 && !foundSolution; attempt++) {
      // Pick a random ray
      const testRayIndex = Math.floor(Math.random() * newRays.length);
      const testRay = newRays[testRayIndex];
      
      // Pick a random mirror position (must be above target and away from origin)
      const testMirrorX = 100 + Math.random() * (CANVAS_WIDTH - 200);
      const testMirrorY = 80 + Math.random() * (TARGET_Y - MIN_DISTANCE_FROM_TARGET - 80);
      
      // Check distance from origin
      const distFromOrigin = Math.sqrt(
        (testMirrorX - newCenterPoint.x) ** 2 + 
        (testMirrorY - newCenterPoint.y) ** 2
      );
      if (distFromOrigin < MIN_DISTANCE_FROM_ORIGIN) continue;
      
      // Check distance from target
      const distFromTarget = Math.abs(TARGET_Y - testMirrorY);
      if (distFromTarget < MIN_DISTANCE_FROM_TARGET) continue;
      
      // Try many more angles to find a solution (every 5 degrees)
      for (let angleAttempt = 0; angleAttempt < 72; angleAttempt++) {
        const testAngle = (angleAttempt / 72) * Math.PI * 2;
        
        // Calculate ray direction
        const rayDir = {
          x: Math.cos(testRay.angle),
          y: Math.sin(testRay.angle)
        };
        
        // Calculate mirror endpoints - THIS MUST MATCH THE RENDERING CODE EXACTLY
        const testMirrorHalfLen = MIRROR_LENGTH / 2;
        const testMirrorStart = {
          x: testMirrorX - Math.cos(testAngle) * testMirrorHalfLen,
          y: testMirrorY - Math.sin(testAngle) * testMirrorHalfLen
        };
        const testMirrorEnd = {
          x: testMirrorX + Math.cos(testAngle) * testMirrorHalfLen,
          y: testMirrorY + Math.sin(testAngle) * testMirrorHalfLen
        };
        
        // Check if ray intersects mirror
        const intersection = rayLineIntersection(newCenterPoint, rayDir, testMirrorStart, testMirrorEnd);
        
        if (!intersection) continue;
        
        // Calculate reflection - THIS MUST MATCH THE RENDERING CODE EXACTLY
        const testMirrorNormal = {
          x: -Math.sin(testAngle),
          y: Math.cos(testAngle)
        };
        
        const reflectedDir = reflect(rayDir, testMirrorNormal);
        
        // Check if reflected ray goes downward
        if (reflectedDir.y <= 0.001) continue;
        
        // Calculate where reflected ray hits TARGET_Y
        const t = (TARGET_Y - intersection.y) / reflectedDir.y;
        if (t <= 0) continue;
        
        const hitX = intersection.x + reflectedDir.x * t;
        
        // Check if it hits the target
        if (hitX >= targetLeft && hitX <= targetRight) {
          // FOUND A SOLUTION! Verify it again to be sure
          let verifyPassed = true;
          
          // Test 3 times with exact same parameters
          for (let verify = 0; verify < 3; verify++) {
            const v_intersection = rayLineIntersection(newCenterPoint, rayDir, testMirrorStart, testMirrorEnd);
            if (!v_intersection) {
              verifyPassed = false;
              break;
            }
            
            const v_reflectedDir = reflect(rayDir, testMirrorNormal);
            const v_t = (TARGET_Y - v_intersection.y) / v_reflectedDir.y;
            if (v_t <= 0) {
              verifyPassed = false;
              break;
            }
            
            const v_hitX = v_intersection.x + v_reflectedDir.x * v_t;
            if (v_hitX < targetLeft || v_hitX > targetRight) {
              verifyPassed = false;
              break;
            }
          }
          
          if (verifyPassed) {
            foundSolution = true;
            solutionRayIndex = testRayIndex;
            solutionMirrorPos = { x: testMirrorX, y: testMirrorY };
            solutionMirrorAngle = testAngle;
            console.log(`✓ Solution found after ${attempt} attempts: ray ${solutionRayIndex}, mirror at (${Math.round(testMirrorX)}, ${Math.round(testMirrorY)}), angle ${Math.round(testAngle * 180 / Math.PI)}°, target at ${Math.round(targetX)}, hit at ${Math.round(hitX)}`);
            break;
          }
        }
      }
    }
    
    if (!foundSolution) {
      console.warn('Failed to find solution, retrying...');
      generateNewLevel();
      return;
    }
    
    // Step 5: Set up the puzzle
    setRays(newRays);
    setSolution({
      mirrorPos: solutionMirrorPos,
      mirrorAngle: solutionMirrorAngle,
      rayIndex: solutionRayIndex
    });
    setIsSolved(false);
    setMirrorPlaced(false);
    
    // Step 6: Spawn the mirror at a different random position (not the solution)
    // USE THE SOLUTION ANGLE! Player only positions it
    const randomX = 150 + Math.random() * (CANVAS_WIDTH - 300);
    const randomY = 100 + Math.random() * (CANVAS_HEIGHT - 200);
    
    setMirror({
      pos: { x: randomX, y: randomY },
      angle: solutionMirrorAngle, // Use the correct angle for the solution!
      length: MIRROR_LENGTH
    });
    setHitCount(0);
  };

  // Handle mouse move
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });
    
    // Only update mirror position (no rotation allowed)
    setMirror(prev => ({
      ...prev,
      pos: { x, y }
    }));
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0 && e.shiftKey) {
      setDragRotate(true);
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        setLastMouseX(e.clientX - rect.left);
      }
    }
  };

  const handleMouseUp = () => {
    setDragRotate(false);
  };

  // Handle keyboard rotation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        setMirror(prev => ({
          ...prev,
          angle: prev.angle - ROTATION_STEP
        }));
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        setMirror(prev => ({
          ...prev,
          angle: prev.angle + ROTATION_STEP
        }));
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Calculate ray-line intersection
  const rayLineIntersection = (
    rayStart: Vector2,
    rayDir: Vector2,
    lineStart: Vector2,
    lineEnd: Vector2
  ): Vector2 | null => {
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

  // Reflect vector across normal
  const reflect = (dir: Vector2, normal: Vector2): Vector2 => {
    const dot = dir.x * normal.x + dir.y * normal.y;
    return {
      x: dir.x - 2 * dot * normal.x,
      y: dir.y - 2 * dot * normal.y
    };
  };

  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    
    // Create ImageData for pixel-perfect rendering
    const imageData = ctx.createImageData(resolution, resolution);
    const data = imageData.data;
    
    // Helper: Check if point is near line
    const isPointNearLine = (
      px: number,
      py: number,
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      threshold: number = 0.5
    ): boolean => {
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
    
    // Helper: Check if point is in circle
    const isPointInCircle = (px: number, py: number, cx: number, cy: number, radius: number): boolean => {
      return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2) <= radius;
    };
    
    // Calculate mirror endpoints
    const mirrorHalfLen = mirror.length / 2;
    const mirrorStart = {
      x: mirror.pos.x - Math.cos(mirror.angle) * mirrorHalfLen,
      y: mirror.pos.y - Math.sin(mirror.angle) * mirrorHalfLen
    };
    const mirrorEnd = {
      x: mirror.pos.x + Math.cos(mirror.angle) * mirrorHalfLen,
      y: mirror.pos.y + Math.sin(mirror.angle) * mirrorHalfLen
    };
    
    // Calculate mirror normal
    const mirrorNormal = {
      x: -Math.sin(mirror.angle),
      y: Math.cos(mirror.angle)
    };
    
    // Calculate ray paths and check hits
    const rayPaths: { start: Vector2; end: Vector2; color: { r: number; g: number; b: number } }[] = [];
    let currentHitCount = 0;
    
    rays.forEach(ray => {
      const rayDir = {
        x: Math.cos(ray.angle),
        y: Math.sin(ray.angle)
      };
      
      // Check intersection with mirror
      const intersection = rayLineIntersection(ray.origin, rayDir, mirrorStart, mirrorEnd);
      
      if (intersection) {
        // Ray hits mirror - draw to intersection
        rayPaths.push({
          start: ray.origin,
          end: intersection,
          color: { r: 255, g: 255, b: 255 }
        });
        
        // Calculate reflected ray
        const reflectedDir = reflect(rayDir, mirrorNormal);
        const reflectedEnd = {
          x: intersection.x + reflectedDir.x * 2000,
          y: intersection.y + reflectedDir.y * 2000
        };
        
        // Check if reflected ray hits target
        const targetLeft = targetCenter.x - TARGET_WIDTH / 2;
        const targetRight = targetCenter.x + TARGET_WIDTH / 2;
        
        // Calculate where reflected ray crosses target Y
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
          } else {
            rayPaths.push({
              start: intersection,
              end: reflectedEnd,
              color: { r: 255, g: 255, b: 255 }
            });
          }
        } else {
          rayPaths.push({
            start: intersection,
            end: reflectedEnd,
            color: { r: 255, g: 255, b: 255 }
          });
        }
      } else {
        // Ray doesn't hit mirror - draw to edge
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
    
    setHitCount(currentHitCount);
    
    // Render each pixel
    for (let py = 0; py < resolution; py++) {
      for (let px = 0; px < resolution; px++) {
        const worldX = (px / resolution) * CANVAS_WIDTH;
        const worldY = (py / resolution) * CANVAS_HEIGHT;
        
        let color = { r: 0, g: 0, b: 0 };
        let isDrawn = false;
        
        // Draw rays
        for (const path of rayPaths) {
          if (isPointNearLine(worldX, worldY, path.start.x, path.start.y, path.end.x, path.end.y, 0.8)) {
            color = path.color;
            isDrawn = true;
            break;
          }
        }
        
        // Draw mirror
        if (!isDrawn && isPointNearLine(worldX, worldY, mirrorStart.x, mirrorStart.y, mirrorEnd.x, mirrorEnd.y, 2)) {
          color = { r: 255, g: 255, b: 255 };
          isDrawn = true;
        }
        
        // Draw ray origin points
        if (!isDrawn) {
          for (const ray of rays) {
            if (isPointInCircle(worldX, worldY, ray.origin.x, ray.origin.y, 3)) {
              color = { r: 255, g: 255, b: 255 };
              isDrawn = true;
              break;
            }
          }
        }
        
        // Draw target zone
        const targetLeft = targetCenter.x - TARGET_WIDTH / 2;
        const targetRight = targetCenter.x + TARGET_WIDTH / 2;
        if (!isDrawn && Math.abs(worldY - TARGET_Y) < 2 && worldX >= targetLeft && worldX <= targetRight) {
          color = { r: 0, g: 255, b: 0 };
          isDrawn = true;
        }
        
        // Draw target marker
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
    
    // Create offscreen canvas
    const offCanvas = document.createElement('canvas');
    offCanvas.width = resolution;
    offCanvas.height = resolution;
    const offCtx = offCanvas.getContext('2d');
    if (!offCtx) return;
    
    offCtx.putImageData(imageData, 0, 0);
    
    // Scale up to main canvas
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.drawImage(offCanvas, 0, 0, resolution, resolution, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // === HUD OVERLAY ===
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
    
    // Corner brackets
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    const bracketSize = 15;
    const margin = 10;
    
    // Top-left
    ctx.beginPath();
    ctx.moveTo(margin + bracketSize, margin);
    ctx.lineTo(margin, margin);
    ctx.lineTo(margin, margin + bracketSize);
    ctx.stroke();
    
    // Top-right
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH - margin - bracketSize, margin);
    ctx.lineTo(CANVAS_WIDTH - margin, margin);
    ctx.lineTo(CANVAS_WIDTH - margin, margin + bracketSize);
    ctx.stroke();
    
    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(margin, CANVAS_HEIGHT - margin - bracketSize);
    ctx.lineTo(margin, CANVAS_HEIGHT - margin);
    ctx.lineTo(margin + bracketSize, CANVAS_HEIGHT - margin);
    ctx.stroke();
    
    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH - margin - bracketSize, CANVAS_HEIGHT - margin);
    ctx.lineTo(CANVAS_WIDTH - margin, CANVAS_HEIGHT - margin);
    ctx.lineTo(CANVAS_WIDTH - margin, CANVAS_HEIGHT - margin - bracketSize);
    ctx.stroke();
    
    // Status display
    ctx.fillStyle = '#00ff00';
    ctx.font = '9px monospace';
    let statusY = 25;
    
    ctx.fillStyle = '#ffff00';
    ctx.fillText('DEFLECTION PROTOCOL', 20, statusY);
    statusY += 12;
    
    ctx.fillStyle = '#00ff00';
    ctx.fillText(`RAYS: ${rays.length}`, 20, statusY);
    statusY += 12;
    
    ctx.fillText(`HITS: ${currentHitCount}/${rays.length}`, 20, statusY);
    statusY += 12;
    
    if (currentHitCount >= 1) {
      ctx.fillStyle = '#00ff00';
      ctx.fillText('STATUS: COMPLETE', 20, statusY);
      // Mark as solved
      if (!isSolved) {
        setIsSolved(true);
      }
    } else {
      ctx.fillStyle = '#ffff00';
      ctx.fillText('STATUS: ACTIVE', 20, statusY);
    }
    statusY += 12;
    
    // Control instructions
    ctx.fillStyle = '#888888';
    ctx.font = '8px monospace';
    ctx.fillText('MOVE: Mouse', 20, statusY);
    statusY += 10;
  }, [rays, mirror, centerPoint, targetCenter, resolution]);

  return (
    <div className="size-full flex items-center justify-center bg-black p-8 gap-8">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        className="border border-white cursor-crosshair"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
}