window.generateLidar = (canvas, objectType, objectId, rotationX, rotationY, rotationZ, objectShape) => {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    // LIDAR parameters based on object type
    const params = getLidarParams(objectType, objectId, objectShape);
    params.rotationX = rotationX || 20;
    params.rotationY = rotationY || 30;
    params.rotationZ = rotationZ || 0;
    
    // Camera position
    const camera = { x: 0, y: 0, z: params.distance };
    
    // Generate rays with seeded random for consistency
    const seed = rotationX * 1000 + rotationY * 100 + rotationZ;
    let rng = (() => {
        let s = seed;
        return () => {
            s = Math.sin(s) * 10000;
            return s - Math.floor(s);
        };
    })();
    
    const hits = [];
    const angleRad = (params.projectionAngle * Math.PI) / 180;

    for (let i = 0; i < params.rayCount; i++) {
        const theta = rng() * Math.PI * 2;
        const phi = rng() * angleRad;

        const dir = {
            x: Math.sin(phi) * Math.cos(theta),
            y: Math.sin(phi) * Math.sin(theta),
            z: -Math.cos(phi),
        };

        const hit = castRay(camera, dir, params);
        if (hit) {
            hits.push(hit);
        }
    }

    // Render hits
    hits.forEach(point => {
        const projected = project3DTo2D(point, width, height);
        if (projected) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(
                Math.floor(projected.x / params.pixelSize) * params.pixelSize,
                Math.floor(projected.y / params.pixelSize) * params.pixelSize,
                params.dotSize,
                params.dotSize
            );
        }
    });
};

function getLidarParams(objectType, objectId, objectShape) {
    const baseParams = {
        pixelSize: 1,
        dotSize: 2,
        rayCount: 3000,
        projectionAngle: 25,
        distance: 3,
        shapeSize: 1,
        rotationX: 310,
        rotationY: 360,
        rotationZ: 290
    };

    // Use shape from JSON instead of type
    baseParams.shapeType = objectShape || 'sphere';
    
    // Customize based on shape
    switch (objectShape) {
        case 'debris':
            return { ...baseParams, rayCount: 2000, rotationY: 45 };
        case 'sphere':
            return { ...baseParams, rayCount: 4000, shapeSize: 1.2 };
        case 'satellite':
            return { ...baseParams, rayCount: 3500, shapeSize: 1.0 };
        case 'spaceship':
            return { ...baseParams, rayCount: 3000, shapeSize: 1.5 };
        case 'rectangular-prism':
            return { ...baseParams, rayCount: 2500, shapeSize: 1.0 };
        case 'station':
            return { ...baseParams, rayCount: 4000, shapeSize: 1.2 };
        case 'probe':
            return { ...baseParams, rayCount: 1500, shapeSize: 0.8 };
        default:
            return { ...baseParams, shapeType: 'sphere' };
    }
}

function castRay(origin, direction, params) {
    switch (params.shapeType) {
        case 'sphere':
            return raySphereIntersection(origin, direction, { x: 0, y: 0, z: 0 }, params.shapeSize);
        case 'debris':
            return rayDebrisIntersection(origin, direction, params.rotationX, params.rotationY, params.rotationZ, params.shapeSize);
        case 'satellite':
            return raySatelliteIntersection(origin, direction, params.rotationX, params.rotationY, params.rotationZ, params.shapeSize);
        case 'spaceship':
            return raySpaceshipIntersection(origin, direction, params.rotationX, params.rotationY, params.rotationZ, params.shapeSize);
        case 'rectangular-prism':
            return rayRectangularPrismIntersection(origin, direction, params.rotationX, params.rotationY, params.rotationZ, params.shapeSize);
        case 'station':
            return rayStationIntersection(origin, direction, params.rotationX, params.rotationY, params.rotationZ, params.shapeSize);
        case 'probe':
            return rayProbeIntersection(origin, direction, params.rotationX, params.rotationY, params.rotationZ, params.shapeSize);
        default:
            return raySphereIntersection(origin, direction, { x: 0, y: 0, z: 0 }, params.shapeSize);
    }
}

function raySphereIntersection(origin, direction, center, radius) {
    const oc = {
        x: origin.x - center.x,
        y: origin.y - center.y,
        z: origin.z - center.z,
    };

    const a = direction.x * direction.x + direction.y * direction.y + direction.z * direction.z;
    const b = 2.0 * (oc.x * direction.x + oc.y * direction.y + oc.z * direction.z);
    const c = oc.x * oc.x + oc.y * oc.y + oc.z * oc.z - radius * radius;

    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return null;

    const t = (-b - Math.sqrt(discriminant)) / (2.0 * a);
    if (t < 0) return null;

    return {
        x: origin.x + direction.x * t,
        y: origin.y + direction.y * t,
        z: origin.z + direction.z * t,
    };
}

function rayDebrisIntersection(origin, direction, rx, ry, rz, size) {
    const invOrigin = rotatePoint(origin, -rx, -ry, -rz);
    const invDir = rotatePoint(direction, -rx, -ry, -rz);

    const pieces = [
        { center: { x: 0, y: 0, z: 0 }, size: size * 0.5, type: 'sphere' },
        { center: { x: size * 0.4, y: size * 0.3, z: 0 }, size: size * 0.3, type: 'sphere' },
        { center: { x: -size * 0.3, y: -size * 0.2, z: size * 0.2 }, size: size * 0.25, type: 'sphere' },
        { center: { x: 0, y: size * 0.4, z: -size * 0.3 }, size: size * 0.2, type: 'sphere' },
    ];

    const hits = [];
    for (const piece of pieces) {
        const hit = raySphereIntersection(invOrigin, invDir, piece.center, piece.size);
        if (hit) hits.push(hit);
    }

    if (hits.length === 0) return null;

    const closest = hits.reduce((a, b) => {
        const distA = Math.sqrt((a.x - invOrigin.x) ** 2 + (a.y - invOrigin.y) ** 2 + (a.z - invOrigin.z) ** 2);
        const distB = Math.sqrt((b.x - invOrigin.x) ** 2 + (b.y - invOrigin.y) ** 2 + (b.z - invOrigin.z) ** 2);
        return distA < distB ? a : b;
    });

    return rotatePoint(closest, rx, ry, rz);
}

function raySatelliteIntersection(origin, direction, rx, ry, rz, size) {
    const invOrigin = rotatePoint(origin, -rx, -ry, -rz);
    const invDir = rotatePoint(direction, -rx, -ry, -rz);

    const bodySize = size * 0.4;
    const panelWidth = size * 0.8;
    const panelThickness = size * 0.05;
    const panelHeight = size * 0.6;

    const hits = [];
    
    // Central body
    const bodyHit = checkBox(invOrigin, invDir, { x: 0, y: 0, z: 0 }, bodySize);
    if (bodyHit) hits.push(bodyHit);
    
    // Left panel
    const leftPanel = checkBox(invOrigin, invDir, { x: -size * 0.6, y: 0, z: 0 }, panelWidth, panelHeight, panelThickness);
    if (leftPanel) hits.push(leftPanel);
    
    // Right panel
    const rightPanel = checkBox(invOrigin, invDir, { x: size * 0.6, y: 0, z: 0 }, panelWidth, panelHeight, panelThickness);
    if (rightPanel) hits.push(rightPanel);

    if (hits.length === 0) return null;

    const closest = hits.reduce((a, b) => {
        const distA = Math.sqrt((a.x - invOrigin.x) ** 2 + (a.y - invOrigin.y) ** 2 + (a.z - invOrigin.z) ** 2);
        const distB = Math.sqrt((b.x - invOrigin.x) ** 2 + (b.y - invOrigin.y) ** 2 + (b.z - invOrigin.z) ** 2);
        return distA < distB ? a : b;
    });

    return rotatePoint(closest, rx, ry, rz);
}

function checkBox(origin, direction, center, width, height, depth) {
    const w = width / 2;
    const h = (height || width) / 2;
    const d = (depth || width) / 2;

    const min = { x: center.x - w, y: center.y - h, z: center.z - d };
    const max = { x: center.x + w, y: center.y + h, z: center.z + d };

    const t1 = (min.x - origin.x) / direction.x;
    const t2 = (max.x - origin.x) / direction.x;
    const t3 = (min.y - origin.y) / direction.y;
    const t4 = (max.y - origin.y) / direction.y;
    const t5 = (min.z - origin.z) / direction.z;
    const t6 = (max.z - origin.z) / direction.z;

    const tmin = Math.max(Math.max(Math.min(t1, t2), Math.min(t3, t4)), Math.min(t5, t6));
    const tmax = Math.min(Math.min(Math.max(t1, t2), Math.max(t3, t4)), Math.max(t5, t6));

    if (tmax < 0 || tmin > tmax) return null;

    const t = tmin < 0 ? tmax : tmin;
    return {
        x: origin.x + direction.x * t,
        y: origin.y + direction.y * t,
        z: origin.z + direction.z * t,
    };
}

function rotatePoint(p, rx, ry, rz) {
    let point = { ...p };
    
    const cosX = Math.cos((rx * Math.PI) / 180);
    const sinX = Math.sin((rx * Math.PI) / 180);
    const y1 = point.y * cosX - point.z * sinX;
    const z1 = point.y * sinX + point.z * cosX;
    point.y = y1;
    point.z = z1;

    const cosY = Math.cos((ry * Math.PI) / 180);
    const sinY = Math.sin((ry * Math.PI) / 180);
    const x2 = point.x * cosY + point.z * sinY;
    const z2 = -point.x * sinY + point.z * cosY;
    point.x = x2;
    point.z = z2;

    const cosZ = Math.cos((rz * Math.PI) / 180);
    const sinZ = Math.sin((rz * Math.PI) / 180);
    const x3 = point.x * cosZ - point.y * sinZ;
    const y3 = point.x * sinZ + point.y * cosZ;
    point.x = x3;
    point.y = y3;

    return point;
}

function raySpaceshipIntersection(origin, direction, rx, ry, rz, size) {
    const invOrigin = rotatePoint(origin, -rx, -ry, -rz);
    const invDir = rotatePoint(direction, -rx, -ry, -rz);

    const hits = [];
    
    // Main hull
    const hullHit = checkBox(invOrigin, invDir, { x: 0, y: 0, z: 0 }, size * 1.2, size * 0.4, size * 0.3);
    if (hullHit) hits.push(hullHit);
    
    // Engine section
    const engineHit = checkBox(invOrigin, invDir, { x: -size * 0.8, y: 0, z: 0 }, size * 0.6, size * 0.3, size * 0.3);
    if (engineHit) hits.push(engineHit);
    
    // Bridge
    const bridgeHit = checkBox(invOrigin, invDir, { x: size * 0.5, y: 0, z: size * 0.2 }, size * 0.3, size * 0.2, size * 0.2);
    if (bridgeHit) hits.push(bridgeHit);

    if (hits.length === 0) return null;
    const closest = hits.reduce((a, b) => {
        const distA = Math.sqrt((a.x - invOrigin.x) ** 2 + (a.y - invOrigin.y) ** 2 + (a.z - invOrigin.z) ** 2);
        const distB = Math.sqrt((b.x - invOrigin.x) ** 2 + (b.y - invOrigin.y) ** 2 + (b.z - invOrigin.z) ** 2);
        return distA < distB ? a : b;
    });
    return rotatePoint(closest, rx, ry, rz);
}

function rayRectangularPrismIntersection(origin, direction, rx, ry, rz, size) {
    const invOrigin = rotatePoint(origin, -rx, -ry, -rz);
    const invDir = rotatePoint(direction, -rx, -ry, -rz);
    
    const hit = checkBox(invOrigin, invDir, { x: 0, y: 0, z: 0 }, size * 0.3, size * 2.0, size * 0.3);
    return hit ? rotatePoint(hit, rx, ry, rz) : null;
}

function rayStationIntersection(origin, direction, rx, ry, rz, size) {
    const invOrigin = rotatePoint(origin, -rx, -ry, -rz);
    const invDir = rotatePoint(direction, -rx, -ry, -rz);

    const hits = [];
    
    // Central hub
    const hubHit = raySphereIntersection(invOrigin, invDir, { x: 0, y: 0, z: 0 }, size * 0.4);
    if (hubHit) hits.push(hubHit);
    
    // Ring structure
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const x = Math.cos(angle) * size * 0.8;
        const y = Math.sin(angle) * size * 0.8;
        const moduleHit = checkBox(invOrigin, invDir, { x, y, z: 0 }, size * 0.2, size * 0.2, size * 0.3);
        if (moduleHit) hits.push(moduleHit);
    }

    if (hits.length === 0) return null;
    const closest = hits.reduce((a, b) => {
        const distA = Math.sqrt((a.x - invOrigin.x) ** 2 + (a.y - invOrigin.y) ** 2 + (a.z - invOrigin.z) ** 2);
        const distB = Math.sqrt((b.x - invOrigin.x) ** 2 + (b.y - invOrigin.y) ** 2 + (b.z - invOrigin.z) ** 2);
        return distA < distB ? a : b;
    });
    return rotatePoint(closest, rx, ry, rz);
}

function rayProbeIntersection(origin, direction, rx, ry, rz, size) {
    const invOrigin = rotatePoint(origin, -rx, -ry, -rz);
    const invDir = rotatePoint(direction, -rx, -ry, -rz);

    const hits = [];
    
    // Main body
    const bodyHit = raySphereIntersection(invOrigin, invDir, { x: 0, y: 0, z: 0 }, size * 0.3);
    if (bodyHit) hits.push(bodyHit);
    
    // Antenna
    const antennaHit = checkBox(invOrigin, invDir, { x: 0, y: 0, z: size * 0.6 }, size * 0.05, size * 0.05, size * 0.8);
    if (antennaHit) hits.push(antennaHit);
    
    // Solar panels
    const panel1Hit = checkBox(invOrigin, invDir, { x: size * 0.4, y: 0, z: 0 }, size * 0.6, size * 0.4, size * 0.02);
    if (panel1Hit) hits.push(panel1Hit);
    const panel2Hit = checkBox(invOrigin, invDir, { x: -size * 0.4, y: 0, z: 0 }, size * 0.6, size * 0.4, size * 0.02);
    if (panel2Hit) hits.push(panel2Hit);

    if (hits.length === 0) return null;
    const closest = hits.reduce((a, b) => {
        const distA = Math.sqrt((a.x - invOrigin.x) ** 2 + (a.y - invOrigin.y) ** 2 + (a.z - invOrigin.z) ** 2);
        const distB = Math.sqrt((b.x - invOrigin.x) ** 2 + (b.y - invOrigin.y) ** 2 + (b.z - invOrigin.z) ** 2);
        return distA < distB ? a : b;
    });
    return rotatePoint(closest, rx, ry, rz);
}

function project3DTo2D(point, width, height) {
    const fov = 400;
    const scale = fov / (point.z + 5);
    
    const x = point.x * scale + width / 2;
    const y = point.y * scale + height / 2;

    if (x < 0 || x > width || y < 0 || y > height) return null;
    return { x, y };
}