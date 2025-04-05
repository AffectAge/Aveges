// drawHexMap.js (с поддержкой слоёв карты)
import SimplexNoise from './simplex-noise.js';

export async function drawHexMap(canvasId, regenerate = false) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  window.mapLayers = window.mapLayers || {
    hexBorders: true,
    continentOverlay: true
  };

  window.redrawHexGrid = () => drawGrid();
  window.hexTextureCache = {}; // глобальный доступ к кэшу

  const fs = window.require('fs');
  const path = window.require('path');
  const settingsPath = path.join('data', 'world_generation_settings.json');
  const mapDir = path.join('data', 'map');
  const continentsPath = path.join(mapDir, 'continents');

  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
  const { seed, rows, cols, zoom, terrain_types } = settings;

  const simplex = new SimplexNoise(() => Math.random());
  const textureCache = {};

  const loadTextures = async () => {
    const fallback = new Image();
    fallback.src = 'assets/terrain/default_terrain.png';
    textureCache['__fallback'] = fallback;

    await Promise.all(Object.entries(terrain_types).map(([type, { texture }]) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => (textureCache[type] = img, resolve());
      img.onerror = () => (textureCache[type] = fallback, resolve());
      img.src = `assets/terrain/${texture}`;
    })));
  };

  await loadTextures();

  const getHexId = (row, col) => row * cols + col;

  const mapData = fs.readdirSync(mapDir)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(mapDir, f), 'utf-8')));

  const continentMap = {};
  if (fs.existsSync(path.join(continentsPath, 'continent_groups.json'))) {
    const data = JSON.parse(fs.readFileSync(path.join(continentsPath, 'continent_groups.json')));
    for (const { id, hexes } of data) {
      for (const hexId of hexes) continentMap[hexId] = id;
    }
  }

  let scale = 1, offsetX = 0, offsetY = 0;
  const baseHexSize = 40;
  const getHexSize = () => baseHexSize * scale;
  const getHexWidth = () => getHexSize() * 2;
  const getHexHeight = () => Math.sqrt(3) * getHexSize();

  const getCachedHexTexture = (terrain, size) => {
    const key = `${terrain}_${size}_${window.mapLayers.hexBorders}`;
    if (window.hexTextureCache[key]) return window.hexTextureCache[key];

    const offCanvas = document.createElement('canvas');
    offCanvas.width = size * 2;
    offCanvas.height = size * 2;
    const offCtx = offCanvas.getContext('2d');
    offCtx.save();
    offCtx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI / 3 * i;
      const px = size + size * Math.cos(angle);
      const py = size + size * Math.sin(angle);
      i ? offCtx.lineTo(px, py) : offCtx.moveTo(px, py);
    }
    offCtx.closePath();
    offCtx.clip();
    offCtx.drawImage(textureCache[terrain] || textureCache['__fallback'], 0, 0, size * 2, size * 2);
    offCtx.restore();

    if (window.mapLayers.hexBorders) {
      offCtx.strokeStyle = '#333';
      offCtx.stroke();
    }

    window.hexTextureCache[key] = offCanvas;
    return offCanvas;
  };

  const isHexVisible = (x, y, hexSize) => (
    x + hexSize > 0 &&
    x - hexSize < canvas.width &&
    y + hexSize > 0 &&
    y - hexSize < canvas.height
  );

  const continentColors = ['#94d82d88', '#4dabf788', '#e8590c88', '#cc5de888', '#845ef788'];

  function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const hexSize = getHexSize();
    const horizDist = 0.75 * getHexWidth();
    const vertDist = getHexHeight();

    for (const { row, col, terrain, id } of mapData) {
      const x = col * horizDist + offsetX + 60;
      const y = row * vertDist + ((col % 2) * (vertDist / 2)) + offsetY + 60;
      if (!isHexVisible(x, y, hexSize)) continue;
      ctx.drawImage(getCachedHexTexture(terrain, hexSize), x - hexSize, y - hexSize);
      if (window.mapLayers.continentOverlay && continentMap[id] !== undefined) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = Math.PI / 3 * i;
          const px = x + hexSize * Math.cos(angle);
          const py = y + hexSize * Math.sin(angle);
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = continentColors[continentMap[id] % continentColors.length];
        ctx.fill();
      }
    }
  }

  canvas.addEventListener('mousedown', e => {
    isDragging = true;
    dragStart = { x: e.clientX, y: e.clientY };
  });
  let isDragging = false, dragStart = { x: 0, y: 0 };
  canvas.addEventListener('mousemove', e => {
    if (isDragging) {
      offsetX += e.clientX - dragStart.x;
      offsetY += e.clientY - dragStart.y;
      dragStart = { x: e.clientX, y: e.clientY };
      drawGrid();
    }
  });
  canvas.addEventListener('mouseup', () => isDragging = false);
  canvas.addEventListener('mouseleave', () => isDragging = false);
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    scale *= e.deltaY < 0 ? 1.1 : 1 / 1.1;
    scale = Math.max(0.3, Math.min(4, scale));
    window.hexTextureCache = {};
    drawGrid();
  });

  drawGrid();
}