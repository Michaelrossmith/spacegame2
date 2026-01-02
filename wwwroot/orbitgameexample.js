import { useEffect, useRef, useState } from 'react';

interface Vector2 {
  x: number;
  y: number;
}

interface GameObject {
  pos: Vector2;
  vel: Vector2;
}

interface Obstacle {
  pos: Vector2;
  radius: number;
  mass: number;
}

type GameState = 'aiming' | 'launching' | 'orbiting' | 'failed' | 'idle';

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Game state
  const [gameState, setGameState] = useState<GameState>('idle');
  const [planet, setPlanet] = useState<Vector2>({ x: 400, y: 300 });
  const [probe, setProbe] = useState<GameObject>({ 
    pos: { x: 200, y: 150 }, 
    vel: { x: 0, y: 0 } 
  });
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [mousePos, setMousePos] = useState<Vector2>({ x: 0, y: 0 });
  const [trajectory, setTrajectory] = useState<Vector2[]>([]);
  const [willCrash, setWillCrash] = useState(false);
  const [willEscape, setWillEscape] = useState(false);
  const [launchSpeed, setLaunchSpeed] = useState(0);
  
  // Tunable parameters
  const [resolution, setResolution] = useState(200); // Lower = more pixelated
  const [planetRadius, setPlanetRadius] = useState(40);
  const [planetMass, setPlanetMass] = useState(15000);
  const [obstacleMass, setObstacleMass] = useState(80);
  const [minSpeed, setMinSpeed] = useState(0.5);
  const [maxSpeed, setMaxSpeed] = useState(8);
  const [speedScale, setSpeedScale] = useState(0.03);
  const [gravityMultiplier, setGravityMultiplier] = useState(0.1);
  const [minObstacles, setMinObstacles] = useState(2);
  const [maxObstacles, setMaxObstacles] = useState(4);
  const [minObstacleRadius, setMinObstacleRadius] = useState(15);
  const [maxObstacleRadius, setMaxObstacleRadius] = useState(35);
  const [animationSpeed, setAnimationSpeed] = useState(2);
  
  const animationFrameRef = useRef<number>();
  const lastFrameTimeRef = useRef<number>(0);
  const offScreenFramesRef = useRef<number>(0);
  const missionStartTimeRef = useRef<number>(0);

  // Initialize game
  useEffect(() => {
    resetGame();
  }, []);

  const resetGame = () => {
    // Planet near center
    const newPlanet = { 
      x: CANVAS_WIDTH / 2 + (Math.random() - 0.5) * 150, 
      y: CANVAS_HEIGHT / 2 + (Math.random() - 0.5) * 150 
    };
    
    // Probe also near center but away from planet
    const angle = Math.random() * Math.PI * 2;
    const distance = 150 + Math.random() * 120;
    let newProbeX = newPlanet.x + Math.cos(angle) * distance;
    let newProbeY = newPlanet.y + Math.sin(angle) * distance;
    
    // Ensure probe spawns at least 10 pixels from screen edges
    newProbeX = Math.max(10, Math.min(CANVAS_WIDTH - 10, newProbeX));
    newProbeY = Math.max(10, Math.min(CANVAS_HEIGHT - 10, newProbeY));
    
    const newProbe = {
      pos: {
        x: newProbeX,
        y: newProbeY
      },
      vel: { x: 0, y: 0 }
    };
    
    // Generate obstacles
    const numObstacles = minObstacles + Math.floor(Math.random() * (maxObstacles - minObstacles + 1));
    const newObstacles: Obstacle[] = [];
    
    for (let i = 0; i < numObstacles; i++) {
      let obstaclePos: Vector2;
      let attempts = 0;
      
      // Keep trying until we find a good position
      do {
        const obstacleAngle = Math.random() * Math.PI * 2;
        const obstacleDistance = 120 + Math.random() * 200;
        obstaclePos = {
          x: newPlanet.x + Math.cos(obstacleAngle) * obstacleDistance,
          y: newPlanet.y + Math.sin(obstacleAngle) * obstacleDistance
        };
        attempts++;
      } while (
        attempts < 20 &&
        (Math.sqrt((obstaclePos.x - newProbe.pos.x) ** 2 + (obstaclePos.y - newProbe.pos.y) ** 2) < 80 ||
         obstaclePos.x < 50 || obstaclePos.x > CANVAS_WIDTH - 50 ||
         obstaclePos.y < 50 || obstaclePos.y > CANVAS_HEIGHT - 50)
      );
      
      const radius = minObstacleRadius + Math.random() * (maxObstacleRadius - minObstacleRadius);
      newObstacles.push({
        pos: obstaclePos,
        radius: radius,
        mass: radius * obstacleMass
      });
    }
    
    setPlanet(newPlanet);
    setProbe(newProbe);
    setObstacles(newObstacles);
    setGameState('idle');
    setTrajectory([]);
    setLaunchSpeed(0);
  };

  // Calculate gravity force from all bodies
  const calculateGravity = (pos: Vector2, planetPos: Vector2, obstacles: Obstacle[]): Vector2 => {
    let totalForceX = 0;
    let totalForceY = 0;
    
    // Planet gravity
    const dx = planetPos.x - pos.x;
    const dy = planetPos.y - pos.y;
    const distSq = dx * dx + dy * dy;
    const dist = Math.sqrt(distSq);
    
    if (dist > 1) {
      const force = planetMass / distSq;
      totalForceX += (dx / dist) * force;
      totalForceY += (dy / dist) * force;
    }
    
    // Obstacle gravity
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

  // Simulate trajectory
  const simulateTrajectory = (startPos: Vector2, startVel: Vector2): { path: Vector2[], crash: boolean, escape: boolean, orbit: boolean } => {
    const path: Vector2[] = [{ ...startPos }];
    let pos = { ...startPos };
    let vel = { ...startVel };
    let crash = false;
    let escape = false;
    let orbit = false;
    
    const maxSteps = 2000;
    let offScreenFrames = 0;
    const maxOffScreenFrames = 200; // Allow being off-screen for up to 200 frames
    
    // Track angle to detect full rotation
    let totalAngleChange = 0;
    let lastAngle = Math.atan2(startPos.y - planet.y, startPos.x - planet.x);
    
    for (let i = 0; i < maxSteps; i++) {
      const gravity = calculateGravity(pos, planet, obstacles);
      vel.x += gravity.x * gravityMultiplier;
      vel.y += gravity.y * gravityMultiplier;
      
      pos.x += vel.x;
      pos.y += vel.y;
      
      const distToPlanet = Math.sqrt((pos.x - planet.x) ** 2 + (pos.y - planet.y) ** 2);
      
      // Check crash with planet
      if (distToPlanet < planetRadius) {
        crash = true;
        path.push({ ...pos });
        break;
      }
      
      // Check crash with obstacles
      for (const obstacle of obstacles) {
        const distToObstacle = Math.sqrt((pos.x - obstacle.pos.x) ** 2 + (pos.y - obstacle.pos.y) ** 2);
        if (distToObstacle < obstacle.radius) {
          crash = true;
          path.push({ ...pos });
          break;
        }
      }
      
      if (crash) break;
      
      // Track off-screen time
      const isOffScreen = pos.x < 0 || pos.x > CANVAS_WIDTH || pos.y < 0 || pos.y > CANVAS_HEIGHT;
      if (isOffScreen) {
        offScreenFrames++;
        // Only fail if off-screen too long OR goes too far away
        if (offScreenFrames > maxOffScreenFrames || 
            pos.x < -200 || pos.x > CANVAS_WIDTH + 200 || 
            pos.y < -200 || pos.y > CANVAS_HEIGHT + 200) {
          escape = true;
          break;
        }
      } else {
        offScreenFrames = 0; // Reset counter when back on screen
      }
      
      // Add to path every few steps to keep it manageable
      if (i % 3 === 0) {
        path.push({ ...pos });
      }
      
      // Track angle change to detect full rotation
      const currentAngle = Math.atan2(pos.y - planet.y, pos.x - planet.x);
      let angleDiff = currentAngle - lastAngle;
      
      // Normalize angle difference to -PI to PI
      if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
      
      totalAngleChange += angleDiff;
      lastAngle = currentAngle;
      
      // Check if completed one full rotation (360 degrees = 2*PI radians)
      if (Math.abs(totalAngleChange) >= Math.PI * 2) {
        orbit = true;
        break;
      }
    }
    
    return { path, crash, escape, orbit };
  };

  // Handle mouse move for aiming
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });
    
    if (gameState === 'aiming') {
      const dx = x - probe.pos.x;
      const dy = y - probe.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist > 0) {
        // Speed based on distance
        const speed = Math.min(maxSpeed, Math.max(minSpeed, dist * speedScale));
        setLaunchSpeed(speed);
        
        const velX = (dx / dist) * speed;
        const velY = (dy / dist) * speed;
        
        const result = simulateTrajectory(probe.pos, { x: velX, y: velY });
        setTrajectory(result.path);
        setWillCrash(result.crash);
        setWillEscape(result.escape);
      }
    }
  };

  // Handle click
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (gameState === 'idle') {
      // Check if clicking on probe
      const distToProbe = Math.sqrt((x - probe.pos.x) ** 2 + (y - probe.pos.y) ** 2);
      if (distToProbe < 15) {
        setGameState('aiming');
      }
    } else if (gameState === 'aiming') {
      // Launch probe
      const dx = x - probe.pos.x;
      const dy = y - probe.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist > 0) {
        const speed = Math.min(maxSpeed, Math.max(minSpeed, dist * speedScale));
        const velX = (dx / dist) * speed;
        const velY = (dy / dist) * speed;
        
        setProbe(prev => ({
          ...prev,
          vel: { x: velX, y: velY }
        }));
        setGameState('launching');
        lastFrameTimeRef.current = performance.now();
        missionStartTimeRef.current = performance.now();
      }
    } else if (gameState === 'failed' || gameState === 'orbiting') {
      resetGame();
    }
  };

  // Animation loop for launched probe
  useEffect(() => {
    if (gameState !== 'launching') return;
    
    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastFrameTimeRef.current;
      const targetFrameTime = 16.67; // 60fps base
      
      if (deltaTime >= targetFrameTime / animationSpeed) {
        lastFrameTimeRef.current = currentTime;
        
        setProbe(prev => {
          const gravity = calculateGravity(prev.pos, planet, obstacles);
          const newVel = {
            x: prev.vel.x + gravity.x * gravityMultiplier,
            y: prev.vel.y + gravity.y * gravityMultiplier
          };
          const newPos = {
            x: prev.pos.x + newVel.x,
            y: prev.pos.y + newVel.y
          };
          
          const distToPlanet = Math.sqrt((newPos.x - planet.x) ** 2 + (newPos.y - planet.y) ** 2);
          
          // Check crash with planet
          if (distToPlanet < planetRadius) {
            setGameState('failed');
            return prev;
          }
          
          // Check crash with obstacles
          for (const obstacle of obstacles) {
            const distToObstacle = Math.sqrt((newPos.x - obstacle.pos.x) ** 2 + (newPos.y - obstacle.pos.y) ** 2);
            if (distToObstacle < obstacle.radius) {
              setGameState('failed');
              return prev;
            }
          }
          
          // Track off-screen time
          const isOffScreen = newPos.x < 0 || newPos.x > CANVAS_WIDTH || newPos.y < 0 || newPos.y > CANVAS_HEIGHT;
          if (isOffScreen) {
            offScreenFramesRef.current++;
            // Only fail if off-screen too long OR goes too far away
            if (offScreenFramesRef.current > 200 || 
                newPos.x < -200 || newPos.x > CANVAS_WIDTH + 200 || 
                newPos.y < -200 || newPos.y > CANVAS_HEIGHT + 200) {
              setGameState('failed');
              return prev;
            }
          } else {
            offScreenFramesRef.current = 0; // Reset counter when back on screen
          }
          
          return { pos: newPos, vel: newVel };
        });
      }
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animationFrameRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameState, planet, obstacles, gravityMultiplier, planetRadius, animationSpeed]);

  // Check for full rotation during launch
  const orbitCheckRef = useRef<{ angle: number, startAngle: number | null, totalRotation: number }>({
    angle: 0,
    startAngle: null,
    totalRotation: 0
  });
  
  useEffect(() => {
    if (gameState === 'launching') {
      const currentAngle = Math.atan2(probe.pos.y - planet.y, probe.pos.x - planet.x);
      
      if (orbitCheckRef.current.startAngle === null) {
        // First frame of launch
        orbitCheckRef.current.startAngle = currentAngle;
        orbitCheckRef.current.angle = currentAngle;
      } else {
        // Calculate angle change
        let angleDiff = currentAngle - orbitCheckRef.current.angle;
        
        // Normalize angle difference to -PI to PI
        if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        
        orbitCheckRef.current.totalRotation += angleDiff;
        orbitCheckRef.current.angle = currentAngle;
        
        // Check if completed one full rotation
        if (Math.abs(orbitCheckRef.current.totalRotation) >= Math.PI * 2) {
          setGameState('orbiting');
          orbitCheckRef.current = { angle: 0, startAngle: null, totalRotation: 0 };
        }
      }
    } else {
      orbitCheckRef.current = { angle: 0, startAngle: null, totalRotation: 0 };
    }
  }, [probe.pos, gameState, planet]);

  // Render with mathematical pixel-perfect rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    
    // Create ImageData for direct pixel manipulation
    const imageData = ctx.createImageData(resolution, resolution);
    const data = imageData.data;
    
    // Helper: Check if point is on a line segment
    const isPointNearLine = (px: number, py: number, x1: number, y1: number, x2: number, y2: number, threshold: number = 0.5): boolean => {
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
    
    // Helper: Check if point is inside circle
    const isPointInCircle = (px: number, py: number, cx: number, cy: number, radius: number): boolean => {
      const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
      return dist <= radius;
    };
    
    // Helper: Check if point is on circle edge
    const isPointOnCircleEdge = (px: number, py: number, cx: number, cy: number, radius: number, thickness: number = 1): boolean => {
      const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
      return Math.abs(dist - radius) <= thickness;
    };
    
    // Calculate orbit progress (0 to 1)
    const orbitProgress = gameState === 'launching' || gameState === 'orbiting' 
      ? Math.min(1, Math.abs(orbitCheckRef.current.totalRotation) / (Math.PI * 2))
      : 0;
    
    // Render each pixel
    for (let py = 0; py < resolution; py++) {
      for (let px = 0; px < resolution; px++) {
        // Convert pixel coords to world coords
        const worldX = (px / resolution) * CANVAS_WIDTH;
        const worldY = (py / resolution) * CANVAS_HEIGHT;
        
        let isWhite = false;
        let color = { r: 0, g: 0, b: 0 }; // Default black
        
        // Check orbit progress fill inside planet (during launching)
        if ((gameState === 'launching' || gameState === 'orbiting') && orbitProgress > 0) {
          const dx = worldX - planet.x;
          const dy = worldY - planet.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < planetRadius - 2) {
            // Calculate angle of this point from planet center
            const angle = Math.atan2(dy, dx);
            // Normalize to 0-2π
            let normalizedAngle = angle < 0 ? angle + Math.PI * 2 : angle;
            
            // Get starting angle from orbit check
            const startAngle = orbitCheckRef.current.startAngle || 0;
            let normalizedStartAngle = startAngle < 0 ? startAngle + Math.PI * 2 : startAngle;
            
            // Calculate if this angle is within the filled portion
            const targetAngle = normalizedStartAngle + orbitProgress * Math.PI * 2;
            
            // Check if point angle is between start and current rotation
            let shouldFill = false;
            if (orbitCheckRef.current.totalRotation >= 0) {
              // Clockwise
              if (targetAngle <= Math.PI * 2) {
                shouldFill = normalizedAngle >= normalizedStartAngle && normalizedAngle <= targetAngle;
              } else {
                shouldFill = normalizedAngle >= normalizedStartAngle || normalizedAngle <= (targetAngle - Math.PI * 2);
              }
            } else {
              // Counter-clockwise
              const targetAngleNeg = normalizedStartAngle + orbitProgress * Math.PI * 2;
              if (targetAngleNeg >= 0) {
                shouldFill = normalizedAngle <= normalizedStartAngle && normalizedAngle >= targetAngleNeg;
              } else {
                shouldFill = normalizedAngle <= normalizedStartAngle || normalizedAngle >= (Math.PI * 2 + targetAngleNeg);
              }
            }
            
            if (shouldFill) {
              color = { r: 255, g: 255, b: 255 };
              isWhite = true;
            }
          }
        }
        
        // Check trajectory lines (if aiming)
        if (gameState === 'aiming' && trajectory.length > 1) {
          for (let i = 0; i < trajectory.length - 1; i++) {
            if (isPointNearLine(worldX, worldY, trajectory[i].x, trajectory[i].y, trajectory[i + 1].x, trajectory[i + 1].y, 1.5)) {
              if (willCrash) {
                color = { r: 255, g: 0, b: 0 };
              } else if (willEscape) {
                color = { r: 128, g: 128, b: 128 };
              } else {
                color = { r: 0, g: 255, b: 0 };
              }
              isWhite = true;
              break;
            }
          }
          
          // Direction line
          if (!isWhite && isPointNearLine(worldX, worldY, probe.pos.x, probe.pos.y, mousePos.x, mousePos.y, 0.8)) {
            color = { r: 100, g: 100, b: 100 };
            isWhite = true;
          }
        }
        
        // Check obstacles
        if (!isWhite) {
          for (const obstacle of obstacles) {
            if (isPointOnCircleEdge(worldX, worldY, obstacle.pos.x, obstacle.pos.y, obstacle.radius, 2)) {
              color = { r: 128, g: 128, b: 128 };
              isWhite = true;
              break;
            }
            
            // Draw X in center
            const xSize = 5;
            if (isPointNearLine(worldX, worldY, obstacle.pos.x - xSize, obstacle.pos.y - xSize, obstacle.pos.x + xSize, obstacle.pos.y + xSize, 0.8) ||
                isPointNearLine(worldX, worldY, obstacle.pos.x + xSize, obstacle.pos.y - xSize, obstacle.pos.x - xSize, obstacle.pos.y + xSize, 0.8)) {
              color = { r: 100, g: 100, b: 100 };
              isWhite = true;
              break;
            }
          }
        }
        
        // Check planet
        if (!isWhite && isPointOnCircleEdge(worldX, worldY, planet.x, planet.y, planetRadius, 2)) {
          color = { r: 255, g: 255, b: 255 };
          isWhite = true;
        }
        
        // Check probe
        if (!isWhite && isPointInCircle(worldX, worldY, probe.pos.x, probe.pos.y, 6)) {
          color = { r: 255, g: 255, b: 255 };
          isWhite = true;
        }
        
        // Set pixel color
        const index = (py * resolution + px) * 4;
        data[index] = color.r;
        data[index + 1] = color.g;
        data[index + 2] = color.b;
        data[index + 3] = 255;
      }
    }
    
    // Create offscreen canvas to draw the low-res image
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
    
    // === MILITARY HUD OVERLAY ===
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
    
    // Crosshair tracking probe
    if (gameState === 'launching' || gameState === 'orbiting') {
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 1;
      const crosshairSize = 20;
      
      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(probe.pos.x - crosshairSize, probe.pos.y);
      ctx.lineTo(probe.pos.x - 5, probe.pos.y);
      ctx.moveTo(probe.pos.x + 5, probe.pos.y);
      ctx.lineTo(probe.pos.x + crosshairSize, probe.pos.y);
      ctx.stroke();
      
      // Vertical line
      ctx.beginPath();
      ctx.moveTo(probe.pos.x, probe.pos.y - crosshairSize);
      ctx.lineTo(probe.pos.x, probe.pos.y - 5);
      ctx.moveTo(probe.pos.x, probe.pos.y + 5);
      ctx.lineTo(probe.pos.x, probe.pos.y + crosshairSize);
      ctx.stroke();
      
      // Tracking lines to edges
      ctx.globalAlpha = 0.3;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(0, probe.pos.y);
      ctx.lineTo(probe.pos.x - crosshairSize, probe.pos.y);
      ctx.moveTo(probe.pos.x + crosshairSize, probe.pos.y);
      ctx.lineTo(CANVAS_WIDTH, probe.pos.y);
      ctx.moveTo(probe.pos.x, 0);
      ctx.lineTo(probe.pos.x, probe.pos.y - crosshairSize);
      ctx.moveTo(probe.pos.x, probe.pos.y + crosshairSize);
      ctx.lineTo(probe.pos.x, CANVAS_HEIGHT);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    
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
    
    // Status display - top left
    ctx.fillStyle = '#00ff00';
    ctx.font = '9px monospace';
    let statusY = 25;
    
    if (gameState === 'idle') {
      ctx.fillStyle = '#ffff00';
      ctx.fillText('STATUS: STANDBY', 20, statusY);
      statusY += 12;
      ctx.fillStyle = '#00ff00';
      ctx.fillText('[CLICK PROBE TO ENGAGE]', 20, statusY);
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
      
      const missionTime = (performance.now() - missionStartTimeRef.current) / 1000;
      ctx.fillText(`TIME: ${missionTime.toFixed(2)}s`, 20, statusY);
      statusY += 12;
      
      const velocity = Math.sqrt(probe.vel.x ** 2 + probe.vel.y ** 2);
      ctx.fillText(`VEL: ${velocity.toFixed(2)} U/S`, 20, statusY);
      statusY += 12;
      
      const distToPlanet = Math.sqrt((probe.pos.x - planet.x) ** 2 + (probe.pos.y - planet.y) ** 2);
      ctx.fillText(`ALT: ${Math.floor(distToPlanet - planetRadius)}`, 20, statusY);
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
    
    // Coordinates display - top right
    ctx.fillStyle = '#00ff00';
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    let coordY = 25;
    ctx.fillText(`X: ${Math.floor(probe.pos.x).toString().padStart(3, '0')}`, CANVAS_WIDTH - 20, coordY);
    coordY += 12;
    ctx.fillText(`Y: ${Math.floor(probe.pos.y).toString().padStart(3, '0')}`, CANVAS_WIDTH - 20, coordY);
    ctx.textAlign = 'left';
    
    // Ruler marks on edges
    ctx.strokeStyle = '#00ff00';
    ctx.fillStyle = '#00ff00';
    ctx.globalAlpha = 0.5;
    ctx.font = '7px monospace';
    
    // Top ruler
    for (let x = 0; x <= CANVAS_WIDTH; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 5);
      ctx.stroke();
      if (x > 0) ctx.fillText(x.toString(), x - 8, 13);
    }
    
    // Left ruler
    for (let y = 0; y <= CANVAS_HEIGHT; y += 80) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(5, y);
      ctx.stroke();
      if (y > 0) ctx.fillText(y.toString(), 8, y + 3);
    }
    
    ctx.globalAlpha = 1;
    
  }, [gameState, planet, probe, trajectory, mousePos, willCrash, willEscape, launchSpeed, obstacles, resolution, planetRadius, minSpeed, maxSpeed]);

  return (
    <div className="size-full flex items-center justify-center bg-black p-8 gap-8">
      <div className="flex flex-col gap-4">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onMouseMove={handleMouseMove}
          onClick={handleClick}
          className="border border-white cursor-crosshair"
          style={{ imageRendering: 'pixelated' }}
        />
        <button
          onClick={resetGame}
          className="px-6 py-2 bg-white text-black font-mono hover:bg-gray-300 transition-colors"
        >
          RESET
        </button>
      </div>
    </div>
  );
}