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
  
  // Создание директорий, если они не существуют
if (!fs.existsSync('data')) fs.mkdirSync('data');
if (!fs.existsSync(mapDir)) fs.mkdirSync(mapDir);
if (!fs.existsSync(continentsPath)) fs.mkdirSync(continentsPath);

// Создание файла настроек по умолчанию
const defaultSettings = {
  seed: 'default',
  rows: 100,
  cols: 100,
  zoom: 0.05,
  continent_count: 3,
  continent_size: 0.4,
  terrain_types: {
    ocean: { threshold: 0.3, texture: 'ocean.png' },
    plain: { threshold: 0.6, texture: 'plain.png' },
    grassland: { threshold: 0.8, texture: 'grassland.png' },
    snow: { threshold: 1.0, texture: 'snow.png' }
  }
};

if (!fs.existsSync(settingsPath)) {
  fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2), 'utf-8');
}

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

  const mapData = [];

if (fs.readdirSync(mapDir).filter(f => f.endsWith('.json')).length === 0) {
  // Генерация карты
  const continentCenters = Array.from({ length: settings.continent_count }, () => ({
    x: Math.floor(Math.random() * settings.cols),
    y: Math.floor(Math.random() * settings.rows)
  }));

  const total = settings.rows * settings.cols;
  let current = 0;

  for (let row = 0; row < settings.rows; row++) {
    for (let col = 0; col < settings.cols; col++) {
      const nx = col * settings.zoom;
      const ny = row * settings.zoom;
      let noise = (simplex.noise2D(nx, ny) + 1) / 2;

      // Влияние континентов
      for (const { x, y } of continentCenters) {
        const dx = (col - x) / settings.cols;
        const dy = (row - y) / settings.rows;
        const dist = Math.hypot(dx, dy);
        noise += Math.max(0, 1 - dist / settings.continent_size) * 0.5;
      }

      noise = Math.min(noise, 1);
      const terrain = Object.entries(settings.terrain_types)
        .find(([_, { threshold }]) => noise <= threshold)?.[0] || 'unknown';

      const id = row * settings.cols + col;
      const hexData = { id, row, col, terrain, neighbors: [] };
      mapData.push(hexData);
	  
	  // Генерация соседей
const even = col % 2 === 0;
const directions = even
  ? [[-1, 0], [-1, -1], [0, -1], [1, 0], [0, 1], [-1, 1]]
  : [[-1, 0], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1]];

const neighbors = directions.map(([dr, dc]) => {
  const nr = row + dr;
  const nc = col + dc;
  return (nr >= 0 && nr < settings.rows && nc >= 0 && nc < settings.cols)
    ? nr * settings.cols + nc
    : null;
}).filter(n => n !== null);

hexData.neighbors = neighbors;

      current++;
      if (current % 500 === 0 || current === total) {
        const percent = Math.floor((current / total) * 100);
        const progressBox = document.getElementById('mapProgress');
        const progressBar = document.getElementById('mapProgressBar');
        if (progressBox && progressBar) {
          progressBox.style.display = 'block';
          progressBox.style.opacity = '1';
          progressBar.style.width = `${percent}%`;
        }
        await new Promise(r => setTimeout(r, 0));
      }
    }
  }
  
  fs.writeFileSync(path.join(mapDir, 'map.json'), JSON.stringify(mapData, null, 2), 'utf-8');

fs.readdirSync(mapDir)
  .filter(f => f.startsWith('hex_') && f.endsWith('.json'))
  .forEach(f => fs.unlinkSync(path.join(mapDir, f)));

  // Скрыть прогресс-бар
  const progressBox = document.getElementById('mapProgress');
  if (progressBox) {
    progressBox.style.opacity = '0';
    setTimeout(() => {
      progressBox.style.display = 'none';
    }, 500);
  }

} else {
  // Загрузка уже существующих гексов
const filePath = path.join(mapDir, 'map.json');
if (fs.existsSync(filePath)) {
  const hexList = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  mapData.push(...hexList);
}

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
    const bleed = 2; // на 2 пикселя больше
offCanvas.width = size * 2 + bleed * 2;
offCanvas.height = size * 2 + bleed * 2;
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
    const horizDist = getHexSize() * 3 / 2; // == size * 1.5
    const vertDist = getHexHeight();

    for (const { row, col, terrain, id } of mapData) {
      const x = col * horizDist + offsetX + 60;
      const y = row * vertDist + ((col % 2) * (vertDist / 2)) + offsetY + 60;
      const bleed = 2; // точно такой же как в getCachedHexTexture
ctx.drawImage(getCachedHexTexture(terrain, hexSize), x - hexSize - bleed, y - hexSize - bleed);
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
    scale = Math.max(0.03, Math.min(4, scale));
    window.hexTextureCache = {};
    drawGrid();
  });

  drawGrid();
}
}