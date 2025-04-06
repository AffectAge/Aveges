import SimplexNoise from './simplex-noise.js';

export async function drawHexMap(canvasId, regenerate = false) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  window.redrawHexGrid = () => drawGrid();
  window.hexTextureCache = {}; // глобальный кэш текстур
  window.countryCache = {}; // кэш для данных стран
  if (!window.flagCache) window.flagCache = {}; // кэш для флагов

  
  const contextMenu = document.getElementById("hexContextMenu");
const colonizeBtn = document.getElementById("colonizeHexBtn");
let rightClickedHex = null;

// ПКМ по гексу
colonizeBtn.addEventListener("click", () => {
    if (!rightClickedHex) return;

    const state = window.require("./code/state").loadGameState();
    const current = state.current_country;
    const fs = window.require("fs");
    const path = window.require("path");

    const countryPath = path.join("data", "countries", current, `${current}.json`);
    const settingsPath = path.join("data", "colonization_settings.json");

    // Загружаем или создаём настройки
    let settings = {
      default_colonization_points: 10,
      default_max_colonizations: 1
    };

    if (!fs.existsSync(settingsPath)) {
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
    } else {
      settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    }

    if (!fs.existsSync(countryPath)) return;
    const countryData = JSON.parse(fs.readFileSync(countryPath, "utf-8"));

    if (!countryData.colonizing_hexes) countryData.colonizing_hexes = [];
    if (typeof countryData.colonization_points !== "number") {
      countryData.colonization_points = settings.default_colonization_points;
    }
    if (typeof countryData.max_colonizations !== "number") {
      countryData.max_colonizations = settings.default_max_colonizations;
    }

    if (countryData.colonizing_hexes.length >= countryData.max_colonizations) {
      alert("Достигнут лимит колонизируемых гексов.");
      return;
    }

    if (!rightClickedHex.colonization) rightClickedHex.colonization = {};
    rightClickedHex.colonization[current] = 0;

    if (!countryData.colonizing_hexes.includes(rightClickedHex.id)) {
      countryData.colonizing_hexes.push(rightClickedHex.id);
    }

    const hexmapPath = path.join("data", "map", "hexmap.json");
    const fullHexMap = JSON.parse(fs.readFileSync(hexmapPath, "utf-8"));
    const hex = fullHexMap.find(h => h.id === rightClickedHex.id);
    if (hex) {
      if (!hex.colonization) hex.colonization = {};
      hex.colonization[current] = 0;
    }

    fs.writeFileSync(hexmapPath, JSON.stringify(fullHexMap, null, 2), "utf-8");
    fs.writeFileSync(countryPath, JSON.stringify(countryData, null, 2), "utf-8");

    contextMenu.classList.add("hidden");
    if (window.redrawHexGrid) window.redrawHexGrid();
  });

canvas.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const hexSize = getHexSize();
  const horizDist = hexSize * 1.5;
  const vertDist = Math.sqrt(3) * hexSize;

  let found = null;

  for (const cell of mapData) {
    let x = cell.col * horizDist + offsetX;
    let y = cell.row * vertDist + ((cell.col % 2) * (vertDist / 2)) + offsetY;

    const dx = mouseX - x;
    const dy = mouseY - y;
    if (Math.sqrt(dx * dx + dy * dy) < hexSize) {
      found = cell;
      break;
    }
  }

  if (!found) return contextMenu.classList.add("hidden");

  rightClickedHex = found;

  const state = window.require("./code/state").loadGameState();
  const current = state.current_country;
  const countryPath = path.join("data", "countries", current, `${current}.json`);
  if (!fs.existsSync(countryPath)) return;

  const countryData = JSON.parse(fs.readFileSync(countryPath, "utf-8"));

  // Условия: гекс без владельца, не превышен лимит
  const already = (countryData.colonizing_hexes || []).includes(found.id);
  const limit = countryData.max_colonizations || 3;

  if (!found.owner && !already && (countryData.colonizing_hexes?.length || 0) < limit) {
    colonizeBtn.style.display = "block";
  } else {
    colonizeBtn.style.display = "none";
  }

  contextMenu.style.left = `${e.clientX}px`;
  contextMenu.style.top = `${e.clientY}px`;
  contextMenu.classList.remove("hidden");
});

// Скрыть при клике вне
document.addEventListener("click", () => contextMenu.classList.add("hidden"));

  const fs   = window.require('fs');
  const path = window.require('path');
  const settingsPath = path.join('data', 'world_generation_settings.json');
  const mapDir       = path.join('data', 'map');
  const continentsPath = path.join(mapDir, 'continents');
  let mapData = [];
  const hexmapPath = path.join(mapDir, "hexmap.json");
  
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
  if (!regenerate && fs.existsSync(hexmapPath)) {
  mapData = JSON.parse(fs.readFileSync(hexmapPath, "utf-8"));
} else {
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

      mapData.push({ id, row, col, elevation: brightness, terrain: terrainType, climate: climateType, continent: continentType, owner: "" });
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
  fs.writeFileSync(hexmapPath, JSON.stringify(mapData, null, 2), "utf-8");
  }

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
  
  // Центр карты
const centerRow = Math.floor(rows / 2);
const centerCol = Math.floor(cols / 2);

// Центрирование и масштаб
scale = 0.1; // или 1, или 1.5 — подбери под свой экран

const hexSize = baseHexSize * scale;
const horizDist = hexSize * 1.5;
const vertDist  = Math.sqrt(3) * hexSize;

const centerX = centerCol * horizDist;
const centerY = centerRow * vertDist + ((centerCol % 2) ? (vertDist / 2) : 0);

// Центрируем карту по экрану
offsetX = canvas.width / 2 - centerX;
offsetY = canvas.height / 2 - centerY;

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
	  
	  // Слой владельца гекса
if (window.mapLayers.ownerOverlay && cell.owner) {
  const owner = cell.owner;
  let fillColor = "#FF11E3";

  if (!window.countryCache[owner]) {
    try {
      const countryPath = path.join("data", "countries", owner, `${owner}.json`);
      if (fs.existsSync(countryPath)) {
        const countryData = JSON.parse(fs.readFileSync(countryPath, 'utf-8'));
        window.countryCache[owner] = countryData.color || "#FF11E3";
      } else {
        window.countryCache[owner] = "#FF11E3";
      }
    } catch (err) {
      console.error("Ошибка при загрузке цвета страны:", err);
      window.countryCache[owner] = "#FF11E3";
    }
  }

  fillColor = window.countryCache[owner];

  ctx.save();
  ctx.globalAlpha = 0.6;
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

// Слой колонизируемых территорий
if (window.mapLayers.colonizationOverlay && cell.colonization) {
  const entries = Object.entries(cell.colonization);
  if (entries.length > 0) {
    const [leader, value] = entries.sort((a, b) => b[1] - a[1])[0];
    const cost = cell.colonization_cost || 100;
    const percent = Math.min(1, value / cost);

    // Цвет из кэша или загрузить
    let fillColor = "#888";
    if (!window.countryCache[leader]) {
      try {
        const filePath = path.join("data", "countries", leader, `${leader}.json`);
        if (fs.existsSync(filePath)) {
          const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
          window.countryCache[leader] = data.color || "#888";
        }
      } catch (err) {
        console.warn("Не удалось загрузить цвет лидера:", err);
      }
    }
    fillColor = window.countryCache[leader] || "#888";

    // Заливка
    ctx.save();
    ctx.globalAlpha = 0.4 + percent * 0.4; // от 0.4 до 0.8
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

    // Отрисовать флаг
    try {
      const flagPath = path.join("data", "countries", leader, `${leader}.json`);
      if (fs.existsSync(flagPath)) {
        const flagData = JSON.parse(fs.readFileSync(flagPath, "utf-8"));
        const img = new Image();
        img.src = flagData.flag;
        if (window.flagCache[leader]) {
  ctx.drawImage(window.flagCache[leader], x - hexSize / 4, y - hexSize / 4, hexSize / 2, hexSize / 2);
} else {
  const flagPath = path.join("data", "countries", leader, `${leader}.json`);
  if (fs.existsSync(flagPath)) {
    const data = JSON.parse(fs.readFileSync(flagPath, "utf-8"));
    const img = new Image();
    img.src = data.flag;
    img.onload = () => {
      window.flagCache[leader] = img;
      if (window.redrawHexGrid) window.redrawHexGrid(); // повторная отрисовка после загрузки
    };
  }
}
      }
    } catch (e) {
      console.warn("Не удалось отрисовать флаг:", e);
    }
  }
}

	  
	  // Отображение ID гекса
const visible = (
  x + hexSize > 0 &&
  x - hexSize < canvas.width &&
  y + hexSize > 0 &&
  y - hexSize < canvas.height
);

if (window.mapLayers.hexIdOverlay && scale > 0.3 && visible) {
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.font = `${Math.max(8, hexSize * 0.35)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2;
  ctx.strokeText(cell.id, x, y);
  ctx.fillText(cell.id, x, y);
  ctx.restore();
}

    }
  }
  
  const infoBox = document.getElementById("hex-info");
canvas.addEventListener("mousemove", (e) => {
  if (isDragging) return;

  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const hexSize = getHexSize();
  const horizDist = hexSize * 1.5;
  const vertDist = Math.sqrt(3) * hexSize;

  let found = null;

  for (const cell of mapData) {
    let x = cell.col * horizDist + offsetX;
    let y = cell.row * vertDist + ((cell.col % 2) * (vertDist / 2)) + offsetY;

    const dx = mouseX - x;
    const dy = mouseY - y;
    if (Math.sqrt(dx * dx + dy * dy) < hexSize) {
      found = cell;
      break;
    }
  }

  if (found) {
    const neighborIds = found.neighbors.join(', ');
    infoBox.innerHTML = `
  <div><span class="text-yellow-400 font-semibold">Государство:</span> ${found.owner}</div>
  <div><span class="text-yellow-400 font-semibold">ID:</span> ${found.id}</div>
  <div><span class="text-yellow-400 font-semibold">Соседи:</span> ${neighborIds}</div>
  <div><span class="text-yellow-400 font-semibold">Ландшафт:</span> ${found.terrain}</div>
  <div><span class="text-yellow-400 font-semibold">Климат:</span> ${found.climate}</div>
  <div><span class="text-yellow-400 font-semibold">Континент:</span> ${found.continent}</div>
  <div><span class="text-yellow-400 font-semibold">Высота:</span> ${found.elevation.toFixed(2)}</div>
  <div><span class="text-yellow-400 font-semibold">Температура:</span> ${found.temperature.toFixed(2)}</div>
  <div><span class="text-yellow-400 font-semibold">Осадки:</span> ${found.precipitation.toFixed(2)}</div>
`;
    infoBox.style.left = `${e.clientX + 12}px`;
    infoBox.style.top = `${e.clientY + 12}px`;
    infoBox.classList.remove("hidden");
  } else {
    infoBox.classList.add("hidden");
  }
});

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
  
  // Скрытие информации о гексе при наведении на другие элементы интерфейса
  document.addEventListener("mousemove", (e) => {
  const canvas = document.getElementById("hexCanvas");
  const infoBox = document.getElementById("hex-info");

  if (!canvas.contains(e.target)) {
    infoBox.classList.add("hidden");
  }
});

  canvas.addEventListener("mouseup", () => isDragging = false);
  canvas.addEventListener("mouseleave", () => isDragging = false);
  canvas.addEventListener("wheel", e => {
  e.preventDefault();

  const mouseX = e.offsetX;
  const mouseY = e.offsetY;

  const oldScale = scale;
  const zoomFactor = 1.1;
  scale *= e.deltaY < 0 ? zoomFactor : 1 / zoomFactor;
  scale = Math.max(0.03, Math.min(4, scale));

  // Корректируем смещение, чтобы зум был относительно курсора
  const scaleRatio = scale / oldScale;
  offsetX = mouseX - (mouseX - offsetX) * scaleRatio;
  offsetY = mouseY - (mouseY - offsetY) * scaleRatio;

  window.hexTextureCache = {};
  drawGrid();
});

  // Кнопка перегенерация карты
  document.getElementById("regenerateMapBtn").addEventListener("click", async () => {
  const confirmReset = confirm("Ты точно хочешь перегенерировать карту? Все ручные изменения будут потеряны.");
  if (confirmReset) {
    await drawHexMap("hexCanvas", true);
  }
});

// Перезагрузка карты
window.reloadHexMap = () => {
  const fs = window.require("fs");
  const path = window.require("path");
  const hexmapPath = path.join("data", "map", "hexmap.json");

  if (!fs.existsSync(hexmapPath)) {
    console.warn("Файл карты не найден:", hexmapPath);
    return;
  }

  try {
    // 💾 Сохраняем текущую позицию и масштаб
    const prevOffsetX = offsetX;
    const prevOffsetY = offsetY;
    const prevScale = scale;

    const freshData = JSON.parse(fs.readFileSync(hexmapPath, "utf-8"));
    mapData = freshData;
    window.hexMapData = freshData;

    // ⚠️ Не вызываем updateAlignment, а сохраняем позицию и масштаб вручную
    offsetX = prevOffsetX;
    offsetY = prevOffsetY;
    scale = prevScale;

    if (window.hexTextureCache) window.hexTextureCache = {};
    if (window.redrawHexGrid) window.redrawHexGrid();
    console.log("Карта перезагружена из hexmap.json");
  } catch (e) {
    console.error("Ошибка при чтении hexmap.json:", e);
  }
};

// Авто обновление карты
setInterval(() => {
  if (window.reloadHexMap) {
    window.reloadHexMap();
    console.log("Карта перерисована");
  }
}, 10000); // каждые 10 секунд

  
  drawGrid();
}