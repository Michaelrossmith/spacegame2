window.initRotationOrb = (canvas, dotNetRef, objectType, objectId, objectShape) => {
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let isDragging = false;
    let lastX = 0, lastY = 0;
    let rotX = 20, rotY = 30, rotZ = 0;
    
    function drawOrb() {
        ctx.clearRect(0, 0, 120, 120);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, 120, 120);
        
        // Draw wireframe sphere
        const centerX = 60, centerY = 60, radius = 30;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        
        // Draw circle outline
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Draw rotation indicators
        const radX = rotX * Math.PI / 180;
        const radY = rotY * Math.PI / 180;
        
        // Horizontal line (Y rotation)
        ctx.beginPath();
        ctx.moveTo(centerX - radius * Math.cos(radY), centerY);
        ctx.lineTo(centerX + radius * Math.cos(radY), centerY);
        ctx.stroke();
        
        // Vertical line (X rotation)
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - radius * Math.cos(radX));
        ctx.lineTo(centerX, centerY + radius * Math.cos(radX));
        ctx.stroke();
        
        // Center dot
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 2, 0, Math.PI * 2);
        ctx.fill();
    }
    
    function updateLidar() {
        const lidarCanvas = canvas.parentElement.parentElement.querySelector('canvas[width="400"]');
        if (lidarCanvas && window.generateLidar) {
            window.generateLidar(lidarCanvas, objectType, objectId, rotX, rotY, rotZ, objectShape);
        }
        dotNetRef.invokeMethodAsync('UpdateRotation', Math.round(rotX), Math.round(rotY));
    }
    
    canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        const rect = canvas.getBoundingClientRect();
        lastX = e.clientX - rect.left;
        lastY = e.clientY - rect.top;
        canvas.style.cursor = 'grabbing';
    });
    
    canvas.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const deltaX = x - lastX;
        const deltaY = y - lastY;
        
        rotY += deltaX * 2;
        rotX += deltaY * 2;
        
        rotX = Math.max(0, Math.min(360, rotX));
        rotY = Math.max(0, Math.min(360, rotY));
        
        lastX = x;
        lastY = y;
        
        drawOrb();
        updateLidar();
    });
    
    canvas.addEventListener('mouseup', () => {
        isDragging = false;
        canvas.style.cursor = 'grab';
    });
    
    canvas.addEventListener('mouseleave', () => {
        isDragging = false;
        canvas.style.cursor = 'grab';
    });
    
    // Initial draw
    drawOrb();
};