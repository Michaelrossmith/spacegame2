window.generateCrossSection = (canvas, objectType, objectId, objectShape, slicePosition) => {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    const resolution = 400;
    const scale = 150;
    const slice = slicePosition || 0;

    // Calculate color based on slice position
    const colorValue = Math.floor(((slice + 2) / 4) * 255);
    const color = `rgb(${255 - colorValue}, ${colorValue}, ${128})`;

    const pixelSize = 1;
    const dotSize = 4;

    for (let px = 0; px < resolution; px += pixelSize) {
        for (let py = 0; py < resolution; py += pixelSize) {
            const x = ((px - resolution / 2) / scale) * 2;
            const y = ((py - resolution / 2) / scale) * 2;

            // Fixed slice plane at z = slicePosition
            const worldPoint = { x, y, z: slice };

            if (isPointInShape(worldPoint, objectShape)) {
                ctx.fillStyle = color;
                ctx.fillRect(px, py, dotSize, dotSize);
            }
        }
    }
};

function isPointInShape(point, shapeType) {
    switch (shapeType) {
        case 'sphere':
            return isPointInSphere(point, 1);
        case 'debris':
            return isPointInDebris(point, 1);
        default:
            return isPointInSphere(point, 1);
    }
}

function isPointInSphere(p, size) {
    const dist = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
    return dist <= size;
}

function isPointInDebris(p, size) {
    const pieces = [
        { center: { x: 0, y: 0, z: 0 }, size: size * 0.5, type: 'box' },
        { center: { x: size * 0.4, y: size * 0.3, z: 0 }, size: size * 0.3, type: 'sphere' },
        { center: { x: -size * 0.3, y: -size * 0.2, z: size * 0.2 }, size: size * 0.25, type: 'box' },
        { center: { x: 0, y: size * 0.4, z: -size * 0.3 }, size: size * 0.2, type: 'sphere' },
        { center: { x: size * 0.2, y: -size * 0.4, z: size * 0.1 }, size: size * 0.15, type: 'box' },
    ];

    for (const piece of pieces) {
        const relative = {
            x: p.x - piece.center.x,
            y: p.y - piece.center.y,
            z: p.z - piece.center.z,
        };

        if (piece.type === 'box') {
            const half = piece.size / 2;
            if (Math.abs(relative.x) <= half && Math.abs(relative.y) <= half && Math.abs(relative.z) <= half) {
                return true;
            }
        } else {
            const dist = Math.sqrt(relative.x ** 2 + relative.y ** 2 + relative.z ** 2);
            if (dist <= piece.size) {
                return true;
            }
        }
    }

    return false;
}