window.initSignalGame = (canvasId) => {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d', { alpha: false });
    const CANVAS_WIDTH = 640;
    const CANVAS_HEIGHT = 400;
    const WAVE_DISPLAY_HEIGHT = 300;
    const CONTROL_AREA_HEIGHT = CANVAS_HEIGHT - WAVE_DISPLAY_HEIGHT;
    const RESOLUTION = 160;
    
    let waves = [];
    let solutionOffsets = [];
    let maxAmplitude = 0;
    let draggingWave = null;
    let won = false;
    let gameComplete = false;
    let winTime = 0;
    let animationFrame = null;
    let targetAmplitude = 2.5;
    let frequencyMultiplier = 1.0;
    
    const generateComplexWave = (seed) => {
        const components = [];
        
        const random = (min, max, idx) => {
            const x = Math.sin(seed * 12.9898 + idx * 78.233) * 43758.5453;
            return min + (x - Math.floor(x)) * (max - min);
        };
        
        const baseFreq = 0.8 + random(0, 0.6, 0);
        
        for (let i = 0; i < 10; i++) {
            const harmonic = i + 1;
            const frequency = baseFreq * harmonic * (0.95 + random(0, 0.1, i));
            const amplitude = (0.2 + random(0, 0.3, i + 10)) / (1 + i * 0.2);
            const phase = random(0, Math.PI * 2, i + 20);
            
            components.push({ frequency, amplitude, phase });
        }
        
        return components;
    };
    
    const resetGame = () => {
        const seed = Math.random() * 1000;
        
        const newWaves = [
            { components: generateComplexWave(seed + 1), offset: 0, color: { r: 255, g: 255, b: 255 } },
            { components: generateComplexWave(seed + 2), offset: 0, color: { r: 255, g: 255, b: 255 } },
            { components: generateComplexWave(seed + 3), offset: 0, color: { r: 255, g: 255, b: 255 } }
        ];
        
        const calculateMaxAmplitudeForOffsets = (waves, offsets) => {
            let max = 0;
            const samples = 500;
            
            for (let i = 0; i < samples; i++) {
                const x = (i / samples) * Math.PI * 4;
                let sum = 0;
                
                for (let w = 0; w < waves.length; w++) {
                    const wave = waves[w];
                    for (const component of wave.components) {
                        sum += component.amplitude * Math.sin(component.frequency * frequencyMultiplier * x + component.phase + offsets[w]);
                    }
                }
                
                const value = Math.abs(sum);
                if (value > max) max = value;
            }
            
            return max;
        };
        
        // Find best alignment
        let highestAmplitude = 0;
        let bestOffsets = [0, 0, 0];
        
        const gridSteps = 8;
        for (let i = 0; i < gridSteps; i++) {
            for (let j = 0; j < gridSteps; j++) {
                for (let k = 0; k < gridSteps; k++) {
                    const testOffsets = [
                        (i / gridSteps) * Math.PI * 4,
                        (j / gridSteps) * Math.PI * 4,
                        (k / gridSteps) * Math.PI * 4
                    ];
                    
                    const maxAmp = calculateMaxAmplitudeForOffsets(newWaves, testOffsets);
                    
                    if (maxAmp > highestAmplitude) {
                        highestAmplitude = maxAmp;
                        bestOffsets = testOffsets;
                    }
                }
            }
        }
        
        targetAmplitude = highestAmplitude * 0.96;
        solutionOffsets = bestOffsets;
        
        // Find worst alignment for starting position
        let lowestAmplitude = Infinity;
        let worstOffsets = [0, 0, 0];
        
        for (let i = 0; i < gridSteps; i++) {
            for (let j = 0; j < gridSteps; j++) {
                for (let k = 0; k < gridSteps; k++) {
                    const testOffsets = [
                        (i / gridSteps) * Math.PI * 4,
                        (j / gridSteps) * Math.PI * 4,
                        (k / gridSteps) * Math.PI * 4
                    ];
                    
                    const maxAmp = calculateMaxAmplitudeForOffsets(newWaves, testOffsets);
                    
                    if (maxAmp < lowestAmplitude) {
                        lowestAmplitude = maxAmp;
                        worstOffsets = testOffsets;
                    }
                }
            }
        }
        
        // Set waves to worst positions
        newWaves[0].offset = worstOffsets[0] % (Math.PI * 4);
        newWaves[1].offset = worstOffsets[1] % (Math.PI * 4);
        newWaves[2].offset = worstOffsets[2] % (Math.PI * 4);
        
        if (newWaves[0].offset < 0) newWaves[0].offset += Math.PI * 4;
        if (newWaves[1].offset < 0) newWaves[1].offset += Math.PI * 4;
        if (newWaves[2].offset < 0) newWaves[2].offset += Math.PI * 4;
        
        waves = newWaves;
        won = false;
        gameComplete = false;
        winTime = 0;
        render();
    };
    
    const calculateWaveValue = (wave, x) => {
        let sum = 0;
        for (const component of wave.components) {
            sum += component.amplitude * Math.sin(component.frequency * frequencyMultiplier * x + component.phase + wave.offset);
        }
        return sum;
    };
    
    const calculateCompositeValue = (x) => {
        let sum = 0;
        for (const wave of waves) {
            sum += calculateWaveValue(wave, x);
        }
        return sum;
    };
    
    const calculateProximity = (waveIndex) => {
        if (solutionOffsets.length === 0 || !waves[waveIndex]) return 0;
        
        const currentOffset = waves[waveIndex].offset;
        const solutionOffset = solutionOffsets[waveIndex];
        
        const diff = Math.abs(currentOffset - solutionOffset);
        const wrappedDiff = Math.min(diff, Math.PI * 4 - diff);
        
        const maxDistance = Math.PI * 2;
        const proximity = Math.max(0, 1 - (wrappedDiff / maxDistance));
        
        return proximity;
    };
    
    const calculateOverallProximity = () => {
        if (waves.length === 0) return 0;
        let sum = 0;
        for (let i = 0; i < waves.length; i++) {
            sum += calculateProximity(i);
        }
        return sum / waves.length;
    };
    
    const render = () => {
        if (waves.length === 0) return;
        
        // Calculate max amplitude
        let max = 0;
        const samples = 500;
        
        for (let i = 0; i < samples; i++) {
            const x = (i / samples) * Math.PI * 4;
            const value = Math.abs(calculateCompositeValue(x));
            if (value > max) max = value;
        }
        
        maxAmplitude = max;
        
        if (max >= targetAmplitude && !won) {
            won = true;
            winTime = Date.now();
            // Start animation loop for progress bar
            if (animationFrame) cancelAnimationFrame(animationFrame);
            const animate = () => {
                render();
                if (!gameComplete) {
                    animationFrame = requestAnimationFrame(animate);
                }
            };
            animate();
        }
        
        // Check if game should be marked complete (3 seconds after win)
        if (won && !gameComplete && Date.now() - winTime >= 3000) {
            gameComplete = true;
        }
        
        // Create low-res ImageData
        const imageData = ctx.createImageData(RESOLUTION, Math.floor(RESOLUTION * (CANVAS_HEIGHT / CANVAS_WIDTH)));
        const data = imageData.data;
        const resHeight = imageData.height;
        
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
        
        const centerY = WAVE_DISPLAY_HEIGHT / 2;
        const scale = 30;
        
        // Sample composite wave
        const wavePoints = [];
        
        for (let i = 0; i < RESOLUTION; i++) {
            const x = (i / RESOLUTION) * Math.PI * 4;
            const value = calculateCompositeValue(x);
            const screenX = (i / RESOLUTION) * CANVAS_WIDTH;
            const screenY = centerY - value * scale;
            wavePoints.push({ x: screenX, y: screenY });
        }
        
        // Render pixels
        for (let py = 0; py < resHeight; py++) {
            for (let px = 0; px < RESOLUTION; px++) {
                const worldX = (px / RESOLUTION) * CANVAS_WIDTH;
                const worldY = (py / resHeight) * CANVAS_HEIGHT;
                
                let color = { r: 0, g: 0, b: 0 };
                
                if (worldY < WAVE_DISPLAY_HEIGHT) {
                    // Center line
                    if (Math.abs(worldY - centerY) < 1) {
                        color = { r: 40, g: 40, b: 40 };
                    }
                    
                    // Composite wave
                    for (let i = 0; i < wavePoints.length - 1; i++) {
                        if (isPointNearLine(worldX, worldY, wavePoints[i].x, wavePoints[i].y, wavePoints[i + 1].x, wavePoints[i + 1].y, 1.5)) {
                            color = { r: 0, g: 255, b: 255 };
                            break;
                        }
                    }
                }
                
                const index = (py * RESOLUTION + px) * 4;
                data[index] = color.r;
                data[index + 1] = color.g;
                data[index + 2] = color.b;
                data[index + 3] = 255;
            }
        }
        
        // Render to canvas
        const offCanvas = document.createElement('canvas');
        offCanvas.width = RESOLUTION;
        offCanvas.height = resHeight;
        const offCtx = offCanvas.getContext('2d');
        offCtx.putImageData(imageData, 0, 0);
        
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.drawImage(offCanvas, 0, 0, RESOLUTION, resHeight, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        // HUD overlay
        ctx.strokeStyle = '#00ff00';
        ctx.fillStyle = '#00ff00';
        ctx.lineWidth = 1;
        
        // Grid
        ctx.globalAlpha = 0.1;
        ctx.beginPath();
        for (let x = 0; x <= CANVAS_WIDTH; x += 40) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, WAVE_DISPLAY_HEIGHT);
        }
        for (let y = 0; y <= WAVE_DISPLAY_HEIGHT; y += 40) {
            ctx.moveTo(0, y);
            ctx.lineTo(CANVAS_WIDTH, y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
        
        // Target lines
        const targetLineY1 = centerY - targetAmplitude * scale;
        const targetLineY2 = centerY + targetAmplitude * scale;
        
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        
        ctx.beginPath();
        ctx.moveTo(0, targetLineY1);
        ctx.lineTo(CANVAS_WIDTH, targetLineY1);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(0, targetLineY2);
        ctx.lineTo(CANVAS_WIDTH, targetLineY2);
        ctx.stroke();
        
        ctx.setLineDash([]);
        
        // Status display
        ctx.fillStyle = '#00ff00';
        ctx.font = '9px monospace';
        let statusY = 25;
        
        ctx.fillText('WAVE INTERFERENCE', 20, statusY);
        statusY += 12;
        ctx.fillText(`AMPLITUDE: ${maxAmplitude.toFixed(2)}`, 20, statusY);
        statusY += 12;
        ctx.fillText(`TARGET: ${targetAmplitude.toFixed(2)}`, 20, statusY);
        
        // Instructions
        ctx.font = '8px monospace';
        ctx.textAlign = 'right';
        let instrY = 25;
        ctx.fillText('DRAG BARS TO ALIGN', CANVAS_WIDTH - 20, instrY);
        instrY += 10;
        ctx.fillText('WAVE PEAKS', CANVAS_WIDTH - 20, instrY);
        ctx.textAlign = 'left';
        
        // Proximity dial
        const overallProximity = calculateOverallProximity();
        const dialCenterX = CANVAS_WIDTH / 2;
        const dialCenterY = 50;
        const dialRadius = 30;
        
        if (won) {
            const pulse = Math.sin(Date.now() / 300) * 0.3 + 0.7;
            ctx.shadowBlur = 30 * pulse;
            ctx.shadowColor = '#00ff00';
            
            ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
            ctx.beginPath();
            ctx.arc(dialCenterX, dialCenterY, dialRadius, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.shadowBlur = 0;
        }
        
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = won ? 3 : 2;
        ctx.beginPath();
        ctx.arc(dialCenterX, dialCenterY, dialRadius, 0, Math.PI * 2);
        ctx.stroke();
        
        if (won) {
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 3;
            
            ctx.beginPath();
            ctx.moveTo(dialCenterX - 10, dialCenterY);
            ctx.lineTo(dialCenterX - 3, dialCenterY + 8);
            ctx.lineTo(dialCenterX + 12, dialCenterY - 8);
            ctx.stroke();
        } else {
            const needleAngle = -Math.PI / 2 + (overallProximity * Math.PI * 1.5);
            const needleLength = dialRadius - 5;
            ctx.strokeStyle = overallProximity > 0.9 ? '#00ff00' : '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(dialCenterX, dialCenterY);
            ctx.lineTo(
                dialCenterX + Math.cos(needleAngle) * needleLength,
                dialCenterY + Math.sin(needleAngle) * needleLength
            );
            ctx.stroke();
            
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(dialCenterX, dialCenterY, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Proximity percentage text or success message
        ctx.fillStyle = won ? '#00ff00' : (overallProximity > 0.9 ? '#00ff00' : '#ffffff');
        ctx.font = won ? '12px monospace' : '10px monospace';
        ctx.textAlign = 'center';
        
        if (won) {
            ctx.fillText('SUCCESS', dialCenterX, dialCenterY + dialRadius + 14);
        } else {
            ctx.fillText(`${(overallProximity * 100).toFixed(0)}%`, dialCenterX, dialCenterY + dialRadius + 12);
            ctx.fillText('ALIGNMENT', dialCenterX, dialCenterY + dialRadius + 22);
        }
        ctx.textAlign = 'left';
        
        // Win overlay with progress bar
        if (won && !gameComplete) {
            const elapsed = Date.now() - winTime;
            const progress = Math.min(elapsed / 3000, 1);
            
            // Semi-transparent overlay
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            
            // "SIGNAL CLEARED" text
            ctx.fillStyle = '#00ff00';
            ctx.font = '24px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('SIGNAL CLEARED', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30);
            
            // Progress bar
            const barWidth = 300;
            const barHeight = 20;
            const barX = (CANVAS_WIDTH - barWidth) / 2;
            const barY = CANVAS_HEIGHT / 2 + 10;
            
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 2;
            ctx.strokeRect(barX, barY, barWidth, barHeight);
            
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(barX + 2, barY + 2, (barWidth - 4) * progress, barHeight - 4);
            
            ctx.textAlign = 'left';
        }
        
        // Control area
        const controlBoxPadding = CANVAS_WIDTH * 0.1;
        const controlBoxLeft = controlBoxPadding;
        const controlBoxRight = CANVAS_WIDTH - controlBoxPadding;
        
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(
            controlBoxPadding, 
            WAVE_DISPLAY_HEIGHT + 10, 
            CANVAS_WIDTH - controlBoxPadding * 2, 
            CONTROL_AREA_HEIGHT - 20
        );
        
        for (let i = 0; i < 3; i++) {
            const wave = waves[i];
            if (!wave) continue;
            
            const proximity = calculateProximity(i);
            const barY = WAVE_DISPLAY_HEIGHT + 20 + i * ((CONTROL_AREA_HEIGHT - 40) / 3) + ((CONTROL_AREA_HEIGHT - 40) / 6);
            
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(controlBoxLeft + 20, barY);
            ctx.lineTo(controlBoxRight - 30, barY);
            ctx.stroke();
            
            const trackWidth = controlBoxRight - controlBoxLeft - 50;
            const sliderX = controlBoxLeft + 20 + (wave.offset / (Math.PI * 4)) * trackWidth;
            const sliderWidth = 16;
            const sliderHeight = 20;
            
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(sliderX - sliderWidth / 2, barY - sliderHeight / 2, sliderWidth, sliderHeight);
            
            ctx.strokeStyle = proximity > 0.85 ? '#ffffff' : '#888888';
            ctx.lineWidth = 2;
            ctx.strokeRect(sliderX - sliderWidth / 2, barY - sliderHeight / 2, sliderWidth, sliderHeight);
            
            // Proximity dots
            ctx.fillStyle = proximity > 0.9 ? '#00ff00' : proximity > 0.7 ? '#ffaa00' : '#666666';
            ctx.beginPath();
            ctx.arc(controlBoxRight - 15, barY, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    };
    
    const handleMouseDown = (e) => {
        if (won) return; // Disable interaction when won
        
        const rect = canvas.getBoundingClientRect();
        const y = e.clientY - rect.top;
        
        if (y >= WAVE_DISPLAY_HEIGHT) {
            const relY = y - WAVE_DISPLAY_HEIGHT;
            const barHeight = CONTROL_AREA_HEIGHT / 3;
            const waveIndex = Math.floor(relY / barHeight);
            
            if (waveIndex >= 0 && waveIndex < 3) {
                draggingWave = waveIndex;
            }
        }
    };
    
    const handleMouseMove = (e) => {
        if (draggingWave === null || won) return; // Disable dragging when won
        
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        
        const controlBoxPadding = CANVAS_WIDTH * 0.1;
        const controlBoxLeft = controlBoxPadding + 20;
        const controlBoxRight = CANVAS_WIDTH - controlBoxPadding - 30;
        const trackWidth = controlBoxRight - controlBoxLeft;
        
        const clampedX = Math.max(controlBoxLeft, Math.min(controlBoxRight, x));
        const normalizedX = (clampedX - controlBoxLeft) / trackWidth;
        const offset = normalizedX * Math.PI * 4;
        
        waves[draggingWave].offset = offset;
        render();
    };
    
    const handleMouseUp = () => {
        draggingWave = null;
    };
    
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);
    
    resetGame();
    
    return {
        reset: () => {
            resetGame();
        },
        isComplete: () => gameComplete
    };
};