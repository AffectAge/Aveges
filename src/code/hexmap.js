// drawHexMap.js (оптимизированная отрисовка карты один раз с прогресс-баром)
import SimplexNoise from './simplex-noise.js';

export async function drawHexMap(canvasId, regenerate = false) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const fs = window.require('fs');
  const path = window.require('path');
  const settingsPath = path.join('data', 'world_generation_settings.json');
  const mapDir = path.join('data', 'map');

  const defaultSettings = {
    seed: 'default',
    rows: 500,
    cols: 1000,
    zoom: 0.07,
    continent_count: 3,
    continent_size: 0.4,
    terrain_types: {
      water: { threshold: 0.3, texture: "water.png" },
      plain: { threshold: 0.5, texture: "plain.png" },
      forest: { threshold: 0.75, texture: "forest.png" },
      mountain: { threshold: 1.0, texture: "mountain.png" }
    }
  };

  if (!fs.existsSync(settingsPath)) {
    fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2), 'utf-8');
  }

  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
  const { seed, rows, cols, zoom, continent_count, continent_size, terrain_types } = settings;

  const progressBox = document.getElementById('mapProgress');
  const progressBar = document.getElementById('mapProgressBar');
  const updateProgress = (percent) => {
    if (progressBox && progressBar) {
      progressBox.style.display = 'block';
      progressBox.style.opacity = '1';
      progressBar.style.width = `${percent}%`;
    }
  };
  const hideProgress = () => {
    if (progressBox) {
      progressBox.style.opacity = '0';
      setTimeout(() => {
        progressBox.style.display = 'none';
      }, 500);
    }
  };

  const makeSeededRandom = (seed) => {
    let x = [...seed].reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0);
    return () => {
      x ^= x << 13;
      x ^= x >> 17;
      x ^= x << 5;
      return (x >>> 0) / 0xFFFFFFFF;
    };
  };

  const rng = makeSeededRandom(seed);
  const simplex = new SimplexNoise(rng);

  const continentCenters = Array.from({ length: continent_count }, () => ({
    x: Math.floor(rng() * cols),
    y: Math.floor(rng() * rows)
  }));

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

  if (!fs.existsSync(mapDir)) {
    fs.mkdirSync(mapDir, { recursive: true });
  } else if (regenerate) {
    fs.readdirSync(mapDir).forEach(file => fs.unlinkSync(path.join(mapDir, file)));
  }

  const getHexId = (row, col) => row * cols + col;
  const getNeighbors = (row, col) => {
    const even = col % 2 === 0;
    const directions = even ? [[-1, 0], [-1, -1], [0, -1], [1, 0], [0, 1], [-1, 1]] : [[-1, 0], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1]];
    return directions.map(([dr, dc]) => {
      const nr = row + dr, nc = col + dc;
      return (nr >= 0 && nr < rows && nc >= 0 && nc < cols) ? getHexId(nr, nc) : null;
    }).filter(id => id !== null);
  };

  const mapData = [];

  if (fs.readdirSync(mapDir).length === 0) {
    const total = rows * cols;
    let current = 0;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const nx = col * zoom, ny = row * zoom;
        let noise = (simplex.noise2D(nx, ny) + 1) / 2;
        for (const { x, y } of continentCenters) {
          const dx = (col - x) / cols, dy = (row - y) / rows;
          const dist = Math.hypot(dx, dy);
          noise += Math.max(0, 1 - dist / continent_size) * 0.5;
        }
        noise = Math.min(noise, 1);
        const terrain = Object.entries(terrain_types).find(([_, { threshold }]) => noise <= threshold)?.[0] || 'unknown';
        const id = getHexId(row, col);
        const neighbors = getNeighbors(row, col);

        const hexData = { id, row, col, terrain, neighbors };
        mapData.push(hexData);
        fs.writeFileSync(path.join(mapDir, `hex_${id}.json`), JSON.stringify(hexData, null, 2), 'utf-8');

        current++;
        if (current % 500 === 0 || current === total) {
          updateProgress(Math.floor((current / total) * 100));
          await new Promise(r => setTimeout(r, 0));
        }
      }
    }
    hideProgress();
  } else {
    for (const file of fs.readdirSync(mapDir).filter(f => f.endsWith('.json'))) {
      const hexData = JSON.parse(fs.readFileSync(path.join(mapDir, file), 'utf-8'));
      mapData.push(hexData);
    }
  }

  let scale = 1, offsetX = 0, offsetY = 0;
  const baseHexSize = 40;
  const getHexSize = () => baseHexSize * scale;
  const getHexWidth = () => getHexSize() * 2;
  const getHexHeight = () => Math.sqrt(3) * getHexSize();

  const hexTextureCache = {};
  const getCachedHexTexture = (terrain, size) => {
    const key = `${terrain}_${size}`;
    if (hexTextureCache[key]) return hexTextureCache[key];

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
    offCtx.strokeStyle = '#333';
    offCtx.stroke();

    hexTextureCache[key] = offCanvas;
    return offCanvas;
  };

  const isHexVisible = (x, y, hexSize) => (
    x + hexSize > 0 &&
    x - hexSize < canvas.width &&
    y + hexSize > 0 &&
    y - hexSize < canvas.height
  );

  const drawHex = (x, y, size, terrain) => {
    const cached = getCachedHexTexture(terrain, size);
    ctx.drawImage(cached, x - size, y - size);
  };

  const drawGrid = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const hexSize = getHexSize();
    const horizDist = 0.75 * getHexWidth();
    const vertDist = getHexHeight();

    for (const { row, col, terrain } of mapData) {
      const x = col * horizDist + offsetX + 60;
      const y = row * vertDist + ((col % 2) * (vertDist / 2)) + offsetY + 60;
      if (isHexVisible(x, y, hexSize)) {
        drawHex(x, y, hexSize, terrain);
      }
    }
  };

  let isDragging = false, dragStart = { x: 0, y: 0 };
  canvas.addEventListener('mousedown', e => {
    isDragging = true;
    dragStart = { x: e.clientX, y: e.clientY };
  });
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
    Object.keys(hexTextureCache).forEach(k => delete hexTextureCache[k]);
    drawGrid();
  });

  drawGrid();
}