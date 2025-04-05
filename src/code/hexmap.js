import SimplexNoise from './simplex-noise.js';

export async function drawHexMap(canvasId, regenerate = false) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  window.mapLayers = window.mapLayers || {
    hexBorders: true,
    continentOverlay: true,
    climateOverlay: true  // слой климатической информации
  };

  window.redrawHexGrid = () => drawGrid();
  window.hexTextureCache = {}; // глобальный кэш текстур

  const fs   = window.require('fs');
  const path = window.require('path');
  const settingsPath = path.join('data', 'world_generation_settings.json');
  const mapDir       = path.join('data', 'map');
  const continentsPath = path.join(mapDir, 'continents');

  // Создаем директории, если их нет
  if (!fs.existsSync('data')) fs.mkdirSync('data');
  if (!fs.existsSync(mapDir)) fs.mkdirSync(mapDir);
  if (!fs.existsSync(continentsPath)) fs.mkdirSync(continentsPath);

  // Файл настроек – названия переменных не меняем, но добавлены новые разделы для масок и типов
  const defaultSettings = {
    seed: "default",
    rows: 100,
    cols: 150,
    zoom: 0.05,
    masks: {
      terrain: "assets/map/terrain_mask.png",
      climate: "assets/map/climate_mask.png",
      continent: "assets/map/continent_mask.png"
    },
    terrain_types: {
      "ocean":     { texture: "ocean.png",     maskColor: "#0000FF" },
      "beach":     { texture: "beach.png",     maskColor: "#FFFF00" },
      "plain":     { texture: "plain.png",     maskColor: "#00B515" },
      "desert":    { texture: "desert.png",    maskColor: "#F4A460" },
      "savanna":   { texture: "savanna.png",   maskColor: "#9ACD32" },
      "grassland": { texture: "grassland.png", maskColor: "#7CFC00" },
      "mountain":  { texture: "mountain.png",  maskColor: "#808080" },
      "snow":      { texture: "snow.png",      maskColor: "#FFFFFF" },
      "taiga":     { texture: "taiga.png",     maskColor: "#228B22" },
      "tundra":    { texture: "tundra.png",    maskColor: "#A9A9A9" }
    },
    climate_types: {
      "arctic":    { color: "#ADD8E6", maskColor: "#000080" },
      "temperate": { color: "#90EE90", maskColor: "#008000" },
      "tropical":  { color: "#FFA07A", maskColor: "#FF4500" }
    },
    continent_types: {
      "continentA": { color: "#FF3838", maskColor: "#8A2BE2" },
      "continentB": { color: "#FF3838", maskColor: "#20B2AA" },
      "continentC": { color: "#FF3838", maskColor: "#2121B7" }
    },
    climate: {
      tempZoom: 0.1,
      precipitationZoom: 0.1,
      precipitationOffset: 100
    },
    elevation: {
      oceanThreshold: 0.3,
      beachThreshold: 0.35,
      mountainThreshold: 0.9
    }
  };

  if (!fs.existsSync(settingsPath)) {
    fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2), "utf-8");
  }
  const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
  const { rows, cols, zoom, terrain_types } = settings;

  const simplex = new SimplexNoise(() => Math.random());
  const textureCache = {};

  // Загрузка текстур
  const loadTextures = async () => {
    const fallback = new Image();
    fallback.src = "assets/terrain/default_terrain.png";
    textureCache["__fallback"] = fallback;
    await Promise.all(Object.entries(terrain_types).map(([type, { texture }]) =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload  = () => { textureCache[type] = img; resolve(); };
        img.onerror = () => { textureCache[type] = fallback; resolve(); };
        img.src     = `assets/terrain/${texture}`;
      })
    ));
  };
  await loadTextures();

  const getHexId = (row, col) => row * cols + col;

  // Загрузка изображений-масок
  function loadMaskImage(maskPath) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = maskPath;
      img.onload = () => resolve(img);
      img.onerror = reject;
    });
  }

  const terrainMaskImage   = await loadMaskImage(settings.masks.terrain);
  const climateMaskImage   = await loadMaskImage(settings.masks.climate);
  const continentMaskImage = await loadMaskImage(settings.masks.continent);

  // Получение данных маски через скрытый canvas
  function getMaskData(img) {
    const c = document.createElement("canvas");
    c.width  = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, img.width, img.height).data;
  }
  const terrainMaskData   = getMaskData(terrainMaskImage);
  const climateMaskData   = getMaskData(climateMaskImage);
  const continentMaskData = getMaskData(continentMaskImage);

  // Преобразование HEX в RGB
  function hexToRgb(hex) {
    hex = hex.replace(/^#/, "");
    const bigint = parseInt(hex, 16);
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
  }

  // Расстояние между двумя цветами
  function colorDistance(c1, c2) {
    return Math.sqrt((c1.r - c2.r) ** 2 + (c1.g - c2.g) ** 2 + (c1.b - c2.b) ** 2);
  }

  // Определение типа по пикселю на основе маски
  function getTypeFromMask(pixelColor, typeConfig, threshold = 60) {
    let bestType = null;
    let bestDistance = Infinity;
    for (let type in typeConfig) {
      const targetColor = hexToRgb(typeConfig[type].maskColor);
      const d = colorDistance(pixelColor, targetColor);
      if (d < bestDistance && d < threshold) {
        bestDistance = d;
        bestType = type;
      }
    }
    return bestType;
  }

  // Формирование карты (сетка гексов)
  const mapData = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const id = getHexId(row, col);
      const pixelX_terrain   = Math.floor((col / cols) * terrainMaskImage.width);
      const pixelY_terrain   = Math.floor((row / rows) * terrainMaskImage.height);
      const pixelX_climate   = Math.floor((col / cols) * climateMaskImage.width);
      const pixelY_climate   = Math.floor((row / rows) * climateMaskImage.height);
      const pixelX_continent = Math.floor((col / cols) * continentMaskImage.width);
      const pixelY_continent = Math.floor((row / rows) * continentMaskImage.height);
      
      const idxT = (pixelY_terrain * terrainMaskImage.width + pixelX_terrain) * 4;
      const terrainPixel = { r: terrainMaskData[idxT], g: terrainMaskData[idxT + 1], b: terrainMaskData[idxT + 2] };
      
      const idxC = (pixelY_climate * climateMaskImage.width + pixelX_climate) * 4;
      const climatePixel = { r: climateMaskData[idxC], g: climateMaskData[idxC + 1], b: climateMaskData[idxC + 2] };
      
      const idxCo = (pixelY_continent * continentMaskImage.width + pixelX_continent) * 4;
      const continentPixel = { r: continentMaskData[idxCo], g: continentMaskData[idxCo + 1], b: continentMaskData[idxCo + 2] };

      const terrainType = getTypeFromMask(terrainPixel, settings.terrain_types) || "grassland";
      const climateType = getTypeFromMask(climatePixel, settings.climate_types) || "temperate";
      const continentType = getTypeFromMask(continentPixel, settings.continent_types) || "continentA";
      
      const brightness = (terrainPixel.r + terrainPixel.g + terrainPixel.b) / (3 * 255);

      mapData.push({ id, row, col, elevation: brightness, terrain: terrainType, climate: climateType, continent: continentType });
    }
  }

  // Генерация соседей для каждого гекса
  for (let cell of mapData) {
    const { row, col } = cell;
    const even = col % 2 === 0;
    const directions = even
      ? [[-1, 0], [-1, -1], [0, -1], [1, 0], [0, 1], [-1, 1]]
      : [[-1, 0], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1]];
    cell.neighbors = directions.map(([dr, dc]) => {
      const nr = row + dr, nc = col + dc;
      return (nr >= 0 && nr < rows && nc >= 0 && nc < cols) ? getHexId(nr, nc) : null;
    }).filter(n => n !== null);
  }

  // Сглаживание (например, имитация эрозии)
  const smoothErosion = (iterations = 2) => {
    for (let it = 0; it < iterations; it++) {
      for (let cell of mapData) {
        let sum = cell.elevation;
        let count = 1;
        for (let nId of cell.neighbors) {
          sum += mapData[nId].elevation;
          count++;
        }
        cell.elevation = sum / count;
      }
    }
  };
  smoothErosion(2);

  // Дополнительные расчеты климата
  for (let cell of mapData) {
    const nx = cell.col * zoom;
    const ny = cell.row * zoom;
    let latitudeFactor = 1 - Math.abs((cell.row / rows) - 0.5) * 2;
    let tempNoise = (simplex.noise2D(nx * settings.climate.tempZoom, ny * settings.climate.tempZoom) + 1) / 2;
    cell.temperature = latitudeFactor * 0.7 + tempNoise * 0.3;
    cell.precipitation = (simplex.noise2D(nx + settings.climate.precipitationOffset, ny + settings.climate.precipitationOffset) + 1) / 2;
  }

  // Сохраняем итоговую карту в hexmap.json
  fs.writeFileSync(path.join(mapDir, "hexmap.json"), JSON.stringify(mapData, null, 2), "utf-8");

  // Функция кэширования текстур для гексов (без зазоров)
  const getCachedHexTexture = (terrain, size) => {
    const key = `${terrain}_${size}_${window.mapLayers.hexBorders}`;
    if (window.hexTextureCache[key]) return window.hexTextureCache[key];
    const offCanvas = document.createElement("canvas");
    const bleed = 0; // убираем зазор
    offCanvas.width = size * 2;
    offCanvas.height = size * 2;
    const offCtx = offCanvas.getContext("2d");
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

    offCtx.fillStyle = "#000"; 
    offCtx.fillRect(0, 0, offCanvas.width, offCanvas.height);
    offCtx.drawImage(textureCache[terrain] || textureCache["__fallback"], 0, 0, size * 2, size * 2);
    offCtx.restore();
    if (window.mapLayers.hexBorders) {
      offCtx.strokeStyle = "#000000";
      offCtx.stroke();
    }
    window.hexTextureCache[key] = offCanvas;
    return offCanvas;
  };

  let scale = 1;
  let offsetX = 0, offsetY = 0;
  const baseHexSize = 40;
  const getHexSize = () => baseHexSize * scale;

  // Функция динамического выравнивания (центровка карты)
  function updateAlignment() {
    const hexSize = getHexSize();
    const horizDist = hexSize * 1.5;
    const vertDist  = Math.sqrt(3) * hexSize;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const cell of mapData) {
      const { row, col } = cell;
      let x = col * horizDist;
      let y = row * vertDist + ((col % 2) ? (vertDist / 2) : 0);
      minX = Math.min(minX, x - hexSize);
      maxX = Math.max(maxX, x + hexSize);
      minY = Math.min(minY, y - hexSize);
      maxY = Math.max(maxY, y + hexSize);
    }
    const gridWidth = maxX - minX;
    const gridHeight = maxY - minY;
    offsetX = (canvas.width - gridWidth) / 2 - minX;
    offsetY = (canvas.height - gridHeight) / 2 - minY;
  }

  // Изначально центрируем карту
  updateAlignment();

  function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const hexSize = getHexSize();
    const horizDist = hexSize * 1.5;
    const vertDist  = Math.sqrt(3) * hexSize;

    for (const cell of mapData) {
      const { row, col, terrain } = cell;
      // Вычисляем координаты центра гекса
      let x = col * horizDist + offsetX;
      let y = row * vertDist + ((col % 2) * (vertDist / 2)) + offsetY;

      x = Math.round(x);
      y = Math.round(y);

      ctx.drawImage(
        getCachedHexTexture(terrain, hexSize),
        x - hexSize,
        y - hexSize
      );

      // Слой континентов
if (window.mapLayers.continentOverlay) {
  let contType = settings.continent_types[cell.continent];
  let fillColor = contType ? contType.color : "#7FC9FF";

  ctx.save();
  ctx.globalAlpha = 0.7; // Устанавливаем прозрачность

  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 3 * i;
    const px = x + hexSize * Math.cos(angle);
    const py = y + hexSize * Math.sin(angle);
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();

  ctx.restore();
}

      // Слой климата
      if (window.mapLayers.climateOverlay) {
        let climateType = settings.climate_types[cell.climate];
        let overlayColor = climateType ? climateType.color : "#90EE90";
  
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = Math.PI / 3 * i;
          const px = x + hexSize * Math.cos(angle);
          const py = y + hexSize * Math.sin(angle);
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = overlayColor;
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // Обработчики событий: перетаскивание и масштабирование
  let isDragging = false, dragStart = { x: 0, y: 0 };
  canvas.addEventListener("mousedown", e => {
    isDragging = true;
    dragStart = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener("mousemove", e => {
    if (isDragging) {
      offsetX += e.clientX - dragStart.x;
      offsetY += e.clientY - dragStart.y;
      dragStart = { x: e.clientX, y: e.clientY };
      drawGrid();
    }
  });
  canvas.addEventListener("mouseup", () => isDragging = false);
  canvas.addEventListener("mouseleave", () => isDragging = false);
  canvas.addEventListener("wheel", e => {
    e.preventDefault();
    scale *= e.deltaY < 0 ? 1.1 : 1 / 1.1;
    scale = Math.max(0.03, Math.min(4, scale));
    window.hexTextureCache = {};
    updateAlignment();
    drawGrid();
  });

  drawGrid();
}