const fs = require('fs');
const path = require('path');

// Указывает путь к файлу state.json, где хранится текущее состояние игры (например, текущий игрок, номер хода и т.д.).
const statePath = path.join(__dirname, '../data/state.json');
const dataDir = path.join(__dirname, '../data');

// Создает state.json
function initGameState() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log("Папка 'data' создана автоматически.");
  }

  if (!fs.existsSync(statePath)) {
    const defaultState = {
      turn: 1,
      current_country: "Player1",
      countrys: ["Player1"]
    };
    fs.writeFileSync(statePath, JSON.stringify(defaultState, null, 2), 'utf-8');
    console.log("Файл 'state.json' создан автоматически.");
  }
}

// Загружает и возвращает текущее состояние игры из JSON-файла.
function loadGameState() {
  initGameState(); // Создает state.json
  return JSON.parse(fs.readFileSync(statePath, 'utf-8'));
}

// Сохраняет текущее состояние игры обратно в файл state.json.
function saveGameState(state) {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
}

function nextTurn() {
  const state = loadGameState();                     // загружаем текущее состояние
  const idx = state.countrys.indexOf(state.current_player); // определяем индекс текущего игрока
  const next = (idx + 1) % state.countrys.length;     // выбираем следующего игрока по кругу
  state.current_country = state.countrys[next];        // обновляем текущего игрока
  if (next === 0) state.turn++;                      // если круг завершён — увеличить номер хода
  saveGameState(state);                              // сохраняем изменения
}

// Делает эти функции доступными для других файлов, например renderer.js, ui.js и т.д.
module.exports = { initGameState, loadGameState, saveGameState, nextTurn };