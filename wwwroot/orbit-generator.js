window.generateOrbit = (canvas, params) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { mainBodySize, orbitingBodySize, orbitRadius, orbitLineWidth, orbitTilt, tiltAxis, orbitAngle, pixelation } = params;

    // Calculate drawing dimensions
    const drawWidth = Math.floor(400 / pixelation);
    const drawHeight = Math.floor(400 / pixelation);

    // Create offscreen canvas
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = drawWidth;
    offscreenCanvas.height = drawHeight;
    const offscreenCtx = offscreenCanvas.getContext('2d', { 
        alpha: false,
        willReadFrequently: false 
    });
    if (!offscreenCtx) return;

    offscreenCtx.imageSmoothingEnabled = false;

    // Clear with black background
    offscreenCtx.fillStyle = '#000000';
    offscreenCtx.fillRect(0, 0, drawWidth, drawHeight);

    const centerX = drawWidth / 2;
    const centerY = drawHeight / 2;

    // Calculate tilt factor
    const tiltFactor = Math.cos((orbitTilt * Math.PI) / 180);
    const axisRad = (tiltAxis * Math.PI) / 180;

    // Scale values
    const scaledOrbitRadius = orbitRadius / pixelation;
    const scaledMainBodySize = mainBodySize / pixelation;
    const scaledOrbitingBodySize = orbitingBodySize / pixelation;

    // Draw orbit ellipse
    offscreenCtx.beginPath();
    offscreenCtx.strokeStyle = '#ffffff';
    offscreenCtx.lineWidth = Math.max(1, orbitLineWidth / pixelation);
    offscreenCtx.ellipse(
        centerX,
        centerY,
        scaledOrbitRadius,
        scaledOrbitRadius * tiltFactor,
        axisRad,
        0,
        Math.PI * 2
    );
    offscreenCtx.stroke();

    // Draw main body
    offscreenCtx.beginPath();
    offscreenCtx.fillStyle = '#ffffff';
    offscreenCtx.arc(centerX, centerY, scaledMainBodySize, 0, Math.PI * 2);
    offscreenCtx.fill();

    // Calculate orbiting body position
    const angleRad = (orbitAngle * Math.PI) / 180;
    const x = Math.cos(angleRad) * scaledOrbitRadius;
    const y = Math.sin(angleRad) * scaledOrbitRadius * tiltFactor;
    
    const orbitingX = centerX + (x * Math.cos(axisRad) - y * Math.sin(axisRad));
    const orbitingY = centerY + (x * Math.sin(axisRad) + y * Math.cos(axisRad));

    // Draw orbiting body
    offscreenCtx.beginPath();
    offscreenCtx.fillStyle = '#ffffff';
    offscreenCtx.arc(orbitingX, orbitingY, scaledOrbitingBodySize, 0, Math.PI * 2);
    offscreenCtx.fill();

    // Convert to pure black and white
    const imageData = offscreenCtx.getImageData(0, 0, drawWidth, drawHeight);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
        const value = brightness > 128 ? 255 : 0;
        
        data[i] = value;
        data[i + 1] = value;
        data[i + 2] = value;
    }
    
    offscreenCtx.putImageData(imageData, 0, 0);

    // Copy to main canvas
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(offscreenCanvas, 0, 0, canvas.width, canvas.height);
};