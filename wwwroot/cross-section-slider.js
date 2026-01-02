window.initCrossSectionSlider = (canvasId, sliderId, objectType, objectId, objectShape, initialSlice, objectValue, objectHabitability, objectDensity, objectOrganics) => {
    const canvas = document.getElementById(canvasId);
    const slider = document.getElementById(sliderId);
    const display = document.getElementById('sliceDisplay');
    
    if (!canvas || !slider) return;
    
    let currentSlice = initialSlice || 0;
    

    
    // Update display function
    const updateDisplay = () => {
        if (display) {
            display.textContent = `SLICE POSITION: ${currentSlice.toFixed(2)}`;
        }
    };
    
    // Generate cross-section function
    const generateCrossSection = (slicePosition) => {
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        // Clear canvas
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);

        const resolution = 400;
        const scale = 150;

        // Calculate base color based on habitability (fixed, not changing with slice position)
        let baseColor;
        
        if (objectHabitability === 'High Possibility') {
            baseColor = `rgb(100, 100, 200)`; // Blue tint
        } else if (objectHabitability === 'Not Habitable' || objectHabitability === 'Dangerous') {
            baseColor = `rgb(200, 100, 100)`; // Red tint
        } else {
            baseColor = `rgb(128, 128, 128)`; // Default gray
        }
        
        // Gold color for valuable objects
        const goldColor = '#FFD700';
        const isHighValue = objectValue === 'High';
        const isMediumValue = objectValue === 'Medium';
        
        // Black for high density
        const blackColor = '#000000';
        const isHighDensity = objectDensity === 'high' || objectDensity === 'very high';
        
        // Green for organics
        const greenColor = '#00FF00';
        const hasOrganics = objectOrganics === 'Detected';

        const pixelSize = 3;
        const dotSize = 3;

        for (let px = 0; px < resolution; px += pixelSize) {
            for (let py = 0; py < resolution; py += pixelSize) {
                const x = ((px - resolution / 2) / scale) * 2;
                const y = ((py - resolution / 2) / scale) * 2;

                const worldPoint = { x, y, z: slicePosition };

                if (isPointInShape(worldPoint, objectShape)) {
                    let pixelColor = baseColor;
                    
                    // Calculate distance from center for sphere density distribution
                    const distanceFromCenter = Math.sqrt(x * x + y * y + slicePosition * slicePosition);
                    
                    // Dense core for spheres with high density (innermost 30%)
                    if (isHighDensity && objectShape === 'sphere' && distanceFromCenter <= 0.3) {
                        pixelColor = blackColor;
                    }
                    // High habitability blue shell for spheres (thin shell at surface)
                    else if (objectHabitability === 'High Possibility' && objectShape === 'sphere' && 
                             distanceFromCenter >= 1.1 && distanceFromCenter <= 1.3 && Math.random() < 0.8) {
                        pixelColor = '#0066FF'; // Bright blue
                    }
                    // High value objects: 30% gold pixels
                    else if (isHighValue && Math.random() < 0.3) {
                        pixelColor = goldColor;
                    }
                    // Medium value objects: 15% gold pixels
                    else if (isMediumValue && Math.random() < 0.15) {
                        pixelColor = goldColor;
                    }
                    // High density objects: concentrated black pixels in center for spheres
                    else if (isHighDensity) {
                        let densityChance = 0.2; // base chance
                        if (objectShape === 'sphere') {
                            // Increase density chance towards center (inverse distance)
                            densityChance = Math.min(0.8, 0.2 + (0.6 * Math.max(0, 1 - distanceFromCenter)));
                        }
                        if (Math.random() < densityChance) {
                            pixelColor = blackColor;
                        }
                    }
                    
                    ctx.fillStyle = pixelColor;
                    ctx.fillRect(px, py, dotSize, dotSize);
                    
                    // Organics: bright green circles on certain slices
                    if (hasOrganics && (Math.abs(slicePosition - 0.5) < 0.1 || Math.abs(slicePosition + 0.5) < 0.1) && Math.random() < 0.1) {
                        ctx.fillStyle = greenColor;
                        ctx.beginPath();
                        ctx.arc(px + dotSize/2, py + dotSize/2, dotSize, 0, 2 * Math.PI);
                        ctx.fill();
                    }
                }
            }
        }
    };
    
    // Slider event listener
    slider.addEventListener('input', (e) => {
        currentSlice = parseFloat(e.target.value);
        generateCrossSection(currentSlice);
        updateDisplay();
    });
    
    // Initial render
    currentSlice = initialSlice || 0;
    slider.value = currentSlice;
    generateCrossSection(currentSlice);
    updateDisplay();
};

function isPointInShape(point, shapeType) {
    switch (shapeType) {
        case 'sphere':
            return isPointInSphere(point, 1.2); // Match LIDAR size
        case 'debris':
            return isPointInDebris(point, 1);
        case 'satellite':
            return isPointInSatellite(point, 1);
        case 'spaceship':
            return isPointInSpaceship(point, 1.5);
        case 'rectangular-prism':
            return isPointInRectangularPrism(point, 1);
        case 'station':
            return isPointInStation(point, 1.2);
        case 'probe':
            return isPointInProbe(point, 0.8);
        default:
            return isPointInSphere(point, 1.2);
    }
}

function isPointInSphere(p, size) {
    const dist = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
    return dist <= size;
}

function isPointInDebris(p, size) {
    // Match exact debris structure from LIDAR generator
    const pieces = [
        { center: { x: 0, y: 0, z: 0 }, size: size * 0.5, type: 'sphere' },
        { center: { x: size * 0.4, y: size * 0.3, z: 0 }, size: size * 0.3, type: 'sphere' },
        { center: { x: -size * 0.3, y: -size * 0.2, z: size * 0.2 }, size: size * 0.25, type: 'sphere' },
        { center: { x: 0, y: size * 0.4, z: -size * 0.3 }, size: size * 0.2, type: 'sphere' },
    ];

    for (const piece of pieces) {
        const relative = {
            x: p.x - piece.center.x,
            y: p.y - piece.center.y,
            z: p.z - piece.center.z,
        };

        const dist = Math.sqrt(relative.x ** 2 + relative.y ** 2 + relative.z ** 2);
        if (dist <= piece.size) {
            return true;
        }
    }

    return false;
}

function isPointInSatellite(p, size) {
    const bodySize = size * 0.4;
    const panelWidth = size * 0.8;
    const panelThickness = size * 0.05;
    const panelHeight = size * 0.6;

    // Central body
    if (Math.abs(p.x) <= bodySize / 2 && Math.abs(p.y) <= bodySize / 2 && Math.abs(p.z) <= bodySize / 2) {
        return true;
    }

    // Left panel
    const leftPanelX = -size * 0.6;
    if (Math.abs(p.x - leftPanelX) <= panelWidth / 2 && Math.abs(p.y) <= panelHeight / 2 && Math.abs(p.z) <= panelThickness / 2) {
        return true;
    }

    // Right panel
    const rightPanelX = size * 0.6;
    if (Math.abs(p.x - rightPanelX) <= panelWidth / 2 && Math.abs(p.y) <= panelHeight / 2 && Math.abs(p.z) <= panelThickness / 2) {
        return true;
    }

    return false;
}

function isPointInSpaceship(p, size) {
    // Main hull
    if (Math.abs(p.x) <= size * 0.6 && Math.abs(p.y) <= size * 0.2 && Math.abs(p.z) <= size * 0.15) {
        return true;
    }
    // Engine section
    if (p.x >= -size * 1.1 && p.x <= -size * 0.5 && Math.abs(p.y) <= size * 0.15 && Math.abs(p.z) <= size * 0.15) {
        return true;
    }
    // Bridge
    if (p.x >= size * 0.35 && p.x <= size * 0.65 && Math.abs(p.y) <= size * 0.1 && p.z >= size * 0.1 && p.z <= size * 0.3) {
        return true;
    }
    return false;
}

function isPointInRectangularPrism(p, size) {
    return Math.abs(p.x) <= size * 0.15 && Math.abs(p.y) <= size * 1.0 && Math.abs(p.z) <= size * 0.15;
}

function isPointInStation(p, size) {
    // Central hub
    const hubDist = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
    if (hubDist <= size * 0.4) {
        return true;
    }
    
    // Ring modules
    const ringDist = Math.sqrt(p.x * p.x + p.y * p.y);
    if (ringDist >= size * 0.7 && ringDist <= size * 0.9 && Math.abs(p.z) <= size * 0.15) {
        return true;
    }
    
    return false;
}

function isPointInProbe(p, size) {
    // Main body
    const bodyDist = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
    if (bodyDist <= size * 0.3) {
        return true;
    }
    
    // Antenna
    if (Math.abs(p.x) <= size * 0.025 && Math.abs(p.y) <= size * 0.025 && p.z >= 0 && p.z <= size * 1.0) {
        return true;
    }
    
    // Solar panels
    if (Math.abs(p.x - size * 0.4) <= size * 0.3 && Math.abs(p.y) <= size * 0.2 && Math.abs(p.z) <= size * 0.01) {
        return true;
    }
    if (Math.abs(p.x + size * 0.4) <= size * 0.3 && Math.abs(p.y) <= size * 0.2 && Math.abs(p.z) <= size * 0.01) {
        return true;
    }
    
    return false;
}