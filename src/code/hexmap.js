export function drawHexMap(canvasId, rows = 50, cols = 100) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const baseHexSize = 40;
  let scale = 1;

  const getHexSize = () => baseHexSize * scale;
  const getHexWidth = () => getHexSize() * 2;
  const getHexHeight = () => Math.sqrt(3) * getHexSize();

  let offsetX = 0;
  let offsetY = 0;

  let isDragging = false;
  let dragStart = { x: 0, y: 0 };

  function drawHex(x, y, size, color = '#4c8ac4') {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI / 3 * i;
      const px = x + size * Math.cos(angle);
      const py = y + size * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.stroke();
  }

  function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const hexSize = getHexSize();
    const hexWidth = getHexWidth();
    const hexHeight = getHexHeight();
    const horizDist = 0.75 * hexWidth;
    const vertDist = hexHeight;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * horizDist + offsetX + 60;
        const y = row * vertDist + ((col % 2) * (vertDist / 2)) + offsetY + 60;
        drawHex(x, y, hexSize);
      }
    }
  }

  // Инициализация
  drawGrid();

  // Перетаскивание карты
  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    dragStart.x = e.clientX;
    dragStart.y = e.clientY;
  });

  canvas.addEventListener('mousemove', (e) => {
    if (isDragging) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      offsetX += dx;
      offsetY += dy;
      dragStart.x = e.clientX;
      dragStart.y = e.clientY;
      drawGrid();
    }
  });

  canvas.addEventListener('mouseup', () => isDragging = false);
  canvas.addEventListener('mouseleave', () => isDragging = false);

  // Зумирование колесиком мыши
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    const mouseX = e.offsetX;
    const mouseY = e.offsetY;

    const prevScale = scale;
    if (e.deltaY < 0) scale *= zoomFactor;
    else scale /= zoomFactor;

    // Ограничение масштаба
    scale = Math.max(0.2, Math.min(4, scale));

    const dx = mouseX - canvas.width / 2;
    const dy = mouseY - canvas.height / 2;

    offsetX -= dx * (scale - prevScale);
    offsetY -= dy * (scale - prevScale);

    drawGrid();
  });
}
