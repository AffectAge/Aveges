const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

const { loadGameState, nextTurn, saveGameState } = require('./code/state');
const { createBackup, listBackups, restoreBackup } = require('./code/backup');
const { updateColonizationProgress } = require("./code/colonization");

function updateTurnDisplay(state) {
  document.getElementById('turn-display').innerText = state.turn;
}

window.createBackup = () => {
  try {
    createBackup();
    alert("Сохранение успешно создан!");
  } catch (err) {
    console.error(err);
    alert("Ошибка при создании сохранения.");
  }
};

window.promptRestoreBackup = () => {
  const backups = listBackups();
  const select = document.getElementById('backup-select');
  select.innerHTML = '<option disabled selected>Выберите сохранение</option>';

  backups.forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  });

  document.getElementById('backup-modal').classList.remove('hidden');
};

window.closeBackupModal = () => {
  document.getElementById('backup-modal').classList.add('hidden');
};

window.confirmRestoreBackup = () => {
  const select = document.getElementById('backup-select');
  const backupName = select.value;
  if (!backupName || backupName === "Выберите сохранение") {
    alert("Пожалуйста, выберите сохранение.");
    return;
  }

  try {
    restoreBackup(backupName);
    alert("Сохранение загружено. Перезагрузка...");
    location.reload();
  } catch (err) {
    console.error(err);
    alert("Ошибка при загрузке сохранения.");
  }
};

window.addEventListener('DOMContentLoaded', () => {
  let state = loadGameState();
  updateTurnDisplay(state);
  
  const countryPath = path.join('data', 'countries', state.current_country, `${state.current_country}.json`);
if (fs.existsSync(countryPath)) {
  const countryData = JSON.parse(fs.readFileSync(countryPath, 'utf-8'));
  const flagImg = document.getElementById('current-flag');
  flagImg.src = countryData.flag || "assets/icons/flag.png";
}

  renderCountryDropdown(state);

  document.getElementById('end-turn').addEventListener('click', () => {
    nextTurn();
	updateColonizationProgress(loadGameState());
    state = loadGameState();
	updateTurnDisplay(state);
    renderCountryDropdown(state);
  });
  
  // Управление сохранениями
window.openSaveManagerModal = () => {
  const saves = listBackups();
  const listContainer = document.getElementById("save-list");
  const modal = document.getElementById("saveManagerModal");
  const input = document.getElementById("backup-name-input");

  listContainer.innerHTML = "";

  if (saves.length === 0) {
    const empty = document.createElement("div");
    empty.textContent = "Нет сохранений.";
    empty.className = "text-gray-400 text-sm";
    listContainer.appendChild(empty);
  } else {
    saves.forEach(name => {
      const row = document.createElement("div");
      row.className = "flex justify-between items-center bg-[#3a3e4a] px-3 py-2 rounded";

      const label = document.createElement("div");
      label.textContent = name;
      label.className = "truncate";

      const actions = document.createElement("div");
      actions.className = "flex gap-2";

      const loadBtn = document.createElement("button");
      loadBtn.textContent = "🔄";
      loadBtn.title = "Загрузить";
      loadBtn.className = "hover:text-green-400";
      loadBtn.onclick = () => {
        if (!confirm(`Ты точно хочешь загрузить сохранение "${name}"?\n⚠️ Текущий прогресс будет утерян.`)) return;
        try {
          restoreBackup(name);
          alert(`Сохранение "${name}" загружено. Перезагрузка...`);
          location.reload();
        } catch (e) {
          alert("Ошибка загрузки сохранения.");
          console.error(e);
        }
      };

      const delBtn = document.createElement("button");
      delBtn.textContent = "🗑️";
      delBtn.title = "Удалить";
      delBtn.className = "hover:text-red-400";
      delBtn.onclick = () => {
        if (confirm(`Удалить сохранение "${name}"?`)) {
          const fs = require("fs");
          const path = require("path");
          const backupPath = path.join("backups", name);
          fs.rmSync(backupPath, { recursive: true, force: true });
          openSaveManagerModal(); // перерисуем
        }
      };

      actions.appendChild(loadBtn);
      actions.appendChild(delBtn);
      row.appendChild(label);
      row.appendChild(actions);
      listContainer.appendChild(row);
    });
  }

  // Показываем модалку
  modal.classList.remove("hidden");

  // Удаляем фокус с кнопки, которая открыла окно
  document.activeElement?.blur();

  // Гарантируем фокус и выделение после полной отрисовки
  setTimeout(() => {
    input.value = "";
    input.focus({ preventScroll: true });
    input.select();
  }, 100);
};



window.closeSaveManagerModal = () => {
  document.getElementById("saveManagerModal").classList.add("hidden");
};

window.createBackupAndReloadList = () => {
  const input = document.getElementById("backup-name-input");
  const customName = input.value.trim();

  if (!customName) {
    alert("Введите название сохранения.");
    return;
  }

  const state = loadGameState();
  const turn = state.turn || 1;

  const safeName = customName.replace(/[^a-zA-Zа-яА-Я0-9 _-]/gu, "_").trim();
  const finalName = `${safeName}-Turn_${turn}`;

  const existing = listBackups();
  if (existing.includes(finalName)) {
    alert(`Сохранение с именем "${finalName}" уже существует.`);
    return;
  }

  try {
    createBackup(finalName);
    input.value = "";
    openSaveManagerModal();
  } catch (e) {
    alert("Ошибка при создании сохранения.");
    console.error(e);
  }
};


// Выпадающий список для выбора или создания страны
  function renderCountryDropdown(state) {
  const dropdown = document.getElementById('dropdown-menu');
  const label = document.getElementById('current-country-label');
  dropdown.innerHTML = '';

  label.textContent = state.current_country || 'Выбрать страну';

  state.countries.forEach(country => {
    const row = document.createElement('div');
    row.className = 'flex justify-between items-center bg-[#3a3e4a] hover:bg-[#4a4e5a] px-2 py-1 rounded text-sm text-white cursor-pointer';

    const nameBtn = document.createElement('button');
    nameBtn.textContent = country;
    nameBtn.className = 'text-left flex-1';
    nameBtn.onclick = () => {
      const s = loadGameState();
      s.current_country = country;
	  const countryPath = path.join('data', 'countries', country, `${country}.json`);
if (fs.existsSync(countryPath)) {
  const countryData = JSON.parse(fs.readFileSync(countryPath, 'utf-8'));
  const flagImg = document.getElementById('current-flag');
  flagImg.src = countryData.flag || "assets/icons/flag.png";
}
      saveGameState(s);
      renderCountryDropdown(s);
      dropdown.classList.add('hidden');
	  
	  // Обновление флага
  const flagImg = document.getElementById('current-flag');
  if (fs.existsSync(countryPath)) {
    const countryData = JSON.parse(fs.readFileSync(countryPath, 'utf-8'));
    flagImg.src = countryData.flag || "assets/icons/flag.png";
  } else {
    flagImg.src = "assets/icons/flag.png";
  }
    };

    const delBtn = document.createElement('button');
    delBtn.textContent = '🗑️';
    delBtn.className = 'text-red-400 hover:text-red-600 px-1';
    delBtn.onclick = (e) => {
      e.stopPropagation();
      if (!confirm(`Удалить страну "${country}"?`)) return;
      const s = loadGameState();
      s.countries = s.countries.filter(c => c !== country);
      if (s.current_country === country) {
        s.current_country = s.countries[0] || '';
      }
      saveGameState(s);
      renderCountryDropdown(s);
    };

    row.appendChild(nameBtn);
    row.appendChild(delBtn);
    dropdown.appendChild(row);
  });

  const addBtn = document.createElement('button');
  addBtn.textContent = '➕ Добавить страну';
  addBtn.className = 'w-full bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-sm';
  addBtn.onclick = () => openAddCountryModal();
  dropdown.appendChild(addBtn);
}

document.getElementById('dropdown-button').addEventListener('click', () => {
  const menu = document.getElementById('dropdown-menu');
  menu.classList.toggle('hidden');
});

document.getElementById('confirm-add-country').addEventListener('click', () => {
  const input = document.getElementById('new-country-name');
  const error = document.getElementById('country-error');
  const colorInput = document.getElementById('new-country-color');
  const flagInput = document.getElementById('new-country-flag');
  const name = input.value.trim();

  if (!name) {
    error.textContent = "Введите название страны";
    error.classList.remove('hidden');
    return;
  }

  const s = loadGameState();
  if (s.countries.includes(name)) {
    error.textContent = "Такая страна уже есть";
    error.classList.remove('hidden');
    input.select();
    return;
  }

  const color = colorInput.value;
  const flagFile = flagInput.files[0];
  let flagFileName = "default.png";

  const safeName = name.replace(/[^a-zA-Zа-яА-Я0-9 _-]/gu, "_");
  const flagDir = path.join('assets', 'countries', 'flags');
  const countryDirPath = path.join('data', 'countries', safeName);

  if (!fs.existsSync(flagDir)) fs.mkdirSync(flagDir, { recursive: true });
  if (!fs.existsSync(countryDirPath)) fs.mkdirSync(countryDirPath, { recursive: true });

  const finalizeCountry = () => {
    const countryData = {
      name: name,
      color: color,
      flag: `assets/countries/flags/${flagFileName}`
    };

    const countryFilePath = path.join(countryDirPath, `${safeName}.json`);
    fs.writeFileSync(countryFilePath, JSON.stringify(countryData, null, 2), 'utf-8');

    s.countries.push(name);
    s.current_country = name;
    saveGameState(s);
    input.value = '';
    error.classList.add('hidden');
    closeAddCountryModal();
    renderCountryDropdown(s);
  };

  if (flagFile) {
    const ext = path.extname(flagFile.name).toLowerCase();
    flagFileName = `${safeName}${ext}`;

    const reader = new FileReader();
    reader.onload = () => {
      const buffer = Buffer.from(reader.result);
      fs.writeFileSync(path.join(flagDir, flagFileName), buffer);
      finalizeCountry();
    };
    reader.readAsArrayBuffer(flagFile);
  } else {
    finalizeCountry();
  }
});


document.getElementById('cancel-add-country').addEventListener('click', () => {
  document.getElementById('country-error').classList.add('hidden');
  document.getElementById('new-country-name').value = '';
  closeAddCountryModal();
});

function openAddCountryModal() {
  document.getElementById('add-country-modal').classList.remove('hidden');
}

function closeAddCountryModal() {
  document.getElementById('add-country-modal').classList.add('hidden');
}

document.getElementById("closeBudgetModal").addEventListener("click", () => {
    document.getElementById("countryBudgetModal").classList.add("hidden");
  });

  // Пример функции показа модального окна с данными
let incomeChartInstance = null;
  let expenseChartInstance = null;

  const modal = document.getElementById("countryBudgetModal");
  const closeBtn = document.getElementById("closeBudgetModal");

  closeBtn.addEventListener("click", () => {
    modal.classList.add("opacity-0");
    setTimeout(() => {
      modal.classList.add("hidden");
      modal.classList.remove("opacity-0");
    }, 300);
  });

  function showCountryBudgetModal(incomeData, expenseData) {
    // Сортировка по убыванию
    incomeData.sort((a, b) => b.value - a.value);
    expenseData.sort((a, b) => b.value - a.value);

    const totalIncome = incomeData.reduce((sum, i) => sum + i.value, 0);
    const totalExpenses = expenseData.reduce((sum, i) => sum + i.value, 0);
    const balance = totalIncome - totalExpenses;

    document.getElementById("totalIncome").textContent = totalIncome.toLocaleString();
    document.getElementById("totalExpenses").textContent = totalExpenses.toLocaleString();
    document.getElementById("balance").textContent = balance.toLocaleString();

    if (incomeChartInstance) incomeChartInstance.destroy();
    if (expenseChartInstance) expenseChartInstance.destroy();

    const chartOptions = {
      responsive: true,
      plugins: {
        datalabels: {
          color: '#fff',
          font: { weight: 'bold' },
          formatter: (value, ctx) => {
            const total = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
            const percentage = total ? ((value / total) * 100).toFixed(1) : "0";
            return `${percentage}%`;
          },
          anchor: 'center',
          align: 'center'
        },
        legend: {
          display: true,
          position: 'left',
          labels: {
            color: '#ccc',
            padding: 10
          }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${ctx.raw.toLocaleString()}`
          }
        }
      }
    };

    incomeChartInstance = new Chart(document.getElementById("incomeChart"), {
      type: 'pie',
      data: {
        labels: incomeData.map(d => d.label),
        datasets: [{
          data: incomeData.map(d => d.value),
          backgroundColor: incomeData.map(d => d.color),
        }]
      },
      options: chartOptions,
      plugins: [ChartDataLabels]
    });

    expenseChartInstance = new Chart(document.getElementById("expenseChart"), {
      type: 'pie',
      data: {
        labels: expenseData.map(d => d.label),
        datasets: [{
          data: expenseData.map(d => d.value),
          backgroundColor: expenseData.map(d => d.color),
        }]
      },
      options: chartOptions,
      plugins: [ChartDataLabels]
    });

    const incomeList = document.getElementById("incomeList");
    incomeList.innerHTML = incomeData.map(item => `
      <li class="flex justify-between">
        <span class="text-left">${item.label}</span>
        <span class="text-green-400">${item.value.toLocaleString()}</span>
      </li>`).join("");

    const expenseList = document.getElementById("expenseList");
    expenseList.innerHTML = expenseData.map(item => `
      <li class="flex justify-between">
        <span class="text-left">${item.label}</span>
        <span class="text-red-400">${item.value.toLocaleString()}</span>
      </li>`).join("");

    modal.classList.remove("hidden");
    modal.classList.add("opacity-0");
    setTimeout(() => modal.classList.remove("opacity-0"), 10);
  }
  
  // Функция для загрузки данных бюджета страны
function getCountryBudgetData(countryName) {
  const fs = require('fs');
  const path = require('path');

  const countryPath = path.join('data', 'countries', countryName, `${countryName}.json`);
  const settingsPath = path.join('data', 'budget_settings.json');

  // Загружаем настройки по умолчанию
  let fallback = {
    income: [],
    expenses: []
  };
  if (!fs.existsSync(settingsPath)) {
    fallback = {
      income: [
        { label: "Подоходный налог", value: 10000, color: "#4caf50" },
        { label: "Корпоративный налог", value: 7000, color: "#81c784" }
      ],
      expenses: [
        { label: "Здравоохранение", value: 8000, color: "#e57373" },
        { label: "Образование", value: 6000, color: "#f06292" }
      ]
    };
    fs.writeFileSync(settingsPath, JSON.stringify(fallback, null, 2), 'utf-8');
  } else {
    fallback = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
  }

  // Если файл страны не найден — возвращаем копию fallback
  if (!fs.existsSync(countryPath)) return JSON.parse(JSON.stringify(fallback));

  const countryData = JSON.parse(fs.readFileSync(countryPath, 'utf-8'));

  // Если budget отсутствует — создаем с нуля
  if (!countryData.budget) {
    countryData.budget = JSON.parse(JSON.stringify(fallback));
  } else {
    // Если есть — проверим, чего не хватает
    const existingIncomeLabels = (countryData.budget.income || []).map(i => i.label);
    const existingExpenseLabels = (countryData.budget.expenses || []).map(e => e.label);

    // Добавим недостающие доходы
    fallback.income.forEach(item => {
      if (!existingIncomeLabels.includes(item.label)) {
        if (!countryData.budget.income) countryData.budget.income = [];
        countryData.budget.income.push(item);
      }
    });

    // Добавим недостающие расходы
    fallback.expenses.forEach(item => {
      if (!existingExpenseLabels.includes(item.label)) {
        if (!countryData.budget.expenses) countryData.budget.expenses = [];
        countryData.budget.expenses.push(item);
      }
    });
  }

  // Сохраняем изменения обратно в файл страны
  fs.writeFileSync(countryPath, JSON.stringify(countryData, null, 2), 'utf-8');

  return countryData.budget;
}

// Кнопка загрузки данных страны
document.getElementById("openBudgetButton").addEventListener("click", () => {
  const state = loadGameState();
  const countryName = state.current_country;

  const budgetData = getCountryBudgetData(countryName);
  showCountryBudgetModal(budgetData.income, budgetData.expenses);
});

// Окно колонизации
function openColonizationModal() {
  const fs = require("fs");
  const path = require("path");

  const state = window.require("./code/state").loadGameState();
  const countryName = state.current_country;
  const countryPath = path.join("data", "countries", countryName, `${countryName}.json`);
  const hexmapPath = path.join("data", "map", "hexmap.json");

  if (!fs.existsSync(countryPath) || !fs.existsSync(hexmapPath)) return;

  const country = JSON.parse(fs.readFileSync(countryPath, "utf-8"));
  const hexmap = JSON.parse(fs.readFileSync(hexmapPath, "utf-8"));

  const container = document.getElementById("colonizationList");
  container.innerHTML = "";

  (country.colonizing_hexes || []).forEach(id => {
    const hex = hexmap.find(h => h.id === id);
    if (!hex) return;

    const progress = hex.colonization?.[countryName] || 0;
    const cost = hex.colonization_cost || 100;
    const percent = Math.min(100, Math.round((progress / cost) * 100));

    const hexDiv = document.createElement("div");
    hexDiv.className = "bg-[#2e2f3b] p-3 rounded-md";

    hexDiv.innerHTML = `
      <div class="flex justify-between items-center mb-1">
        <div><strong>${hex.name || "Гекс"} (ID: ${hex.id})</strong></div>
        <button class="text-red-400 hover:text-red-200 text-sm" data-id="${hex.id}">Отменить</button>
      </div>
      <div class="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
        <div class="bg-green-500 h-4" style="width: ${percent}%"></div>
      </div>
      <div class="text-right text-xs mt-1">${percent}%</div>
    `;

    container.appendChild(hexDiv);
  });

  document.getElementById("colonizationModal").classList.remove("hidden");

  // обработка кнопок "Отменить"
  container.querySelectorAll("button[data-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      const hexId = parseInt(btn.getAttribute("data-id"));
      cancelColonization(hexId, countryName);
      openColonizationModal(); // обновить окно
      if (window.redrawHexGrid) window.redrawHexGrid();
    });
  });
}

// Окно колонизации
function openColonizationModal() {
  const fs = require("fs");
  const path = require("path");

  const state = window.require("./code/state").loadGameState();
  const countryName = state.current_country;
  const countryPath = path.join("data", "countries", countryName, `${countryName}.json`);
  const hexmapPath = path.join("data", "map", "hexmap.json");

  if (!fs.existsSync(countryPath) || !fs.existsSync(hexmapPath)) return;

  const country = JSON.parse(fs.readFileSync(countryPath, "utf-8"));
  const hexmap = JSON.parse(fs.readFileSync(hexmapPath, "utf-8"));

  const container = document.getElementById("colonizationList");
  container.innerHTML = "";

  (country.colonizing_hexes || []).forEach(id => {
    const hex = hexmap.find(h => h.id === id);
    if (!hex) return;

    const progress = hex.colonization?.[countryName] || 0;
    const cost = hex.colonization_cost || 100;
    const percent = Math.min(100, Math.round((progress / cost) * 100));

    const colonizationPoints = country.colonization_points || 0;
    const activeHexes = (country.colonizing_hexes || []).length || 1;
    const pointsPerHex = Math.floor(colonizationPoints / activeHexes);
    const turnsLeft = pointsPerHex > 0 ? Math.ceil((cost - progress) / pointsPerHex) : "∞";

    const hexDiv = document.createElement("div");
    hexDiv.className = "bg-[#2e2f3b] p-3 rounded-md";

    const header = document.createElement("div");
    header.className = "flex justify-between items-center mb-2";

    const title = document.createElement("div");
    title.className = "text-base font-medium text-white";
    title.innerHTML = `${hex.name || "Гекс"} <span class="text-gray-400 text-sm">(ID: ${hex.id})</span>`;

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Отменить";
    cancelBtn.className = "text-red-400 hover:text-red-200 text-xs px-2 py-1 rounded border border-red-400";
    cancelBtn.addEventListener("click", () => {
      cancelColonization(hex.id, countryName);
      openColonizationModal();
      if (window.redrawHexGrid) window.redrawHexGrid();
    });

    header.appendChild(title);
    header.appendChild(cancelBtn);
    hexDiv.appendChild(header);

    const progressBlock = document.createElement("div");
    progressBlock.innerHTML = `
      <div class="mb-1 text-xs text-gray-300">Ваш прогресс: ${percent}% &nbsp;&nbsp; ⏳ ~${turnsLeft} ход(ов)</div>
      <div class="w-full bg-gray-800 rounded-full h-5 overflow-hidden mb-2">
        <div class="bg-green-500 h-5 transition-all duration-300 ease-in-out" style="width: ${percent}%"></div>
      </div>
    `;
    hexDiv.appendChild(progressBlock);

    const others = Object.entries(hex.colonization || {}).filter(([key]) => key !== countryName);
    if (others.length > 0) {
      const otherProgress = document.createElement("div");
      otherProgress.className = "space-y-1 mt-2";

      others.forEach(([other, val]) => {
        const p = Math.min(100, Math.round((val / cost) * 100));
        const bar = document.createElement("div");
        bar.innerHTML = `
          <div class="text-xs text-gray-400">${other}: ${p}%</div>
          <div class="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
            <div class="bg-yellow-500 h-2" style="width: ${p}%"></div>
          </div>
        `;
        otherProgress.appendChild(bar);
      });

      hexDiv.appendChild(otherProgress);
    }

    container.appendChild(hexDiv);
  });

  document.getElementById("colonizationModal").classList.remove("hidden");
}

window.openColonizationModal = openColonizationModal;

function openColonizationModal() {
  const fs = require("fs");
  const path = require("path");

  const state = window.require("./code/state").loadGameState();
  const countryName = state.current_country;
  const countryPath = path.join("data", "countries", countryName, `${countryName}.json`);
  const hexmapPath = path.join("data", "map", "hexmap.json");

  if (!fs.existsSync(countryPath) || !fs.existsSync(hexmapPath)) return;

  const country = JSON.parse(fs.readFileSync(countryPath, "utf-8"));
  const hexmap = JSON.parse(fs.readFileSync(hexmapPath, "utf-8"));

  const container = document.getElementById("colonizationList");
  container.innerHTML = "";

  (country.colonizing_hexes || []).forEach(id => {
    const hex = hexmap.find(h => h.id === id);
    if (!hex) return;

    const progress = hex.colonization?.[countryName] || 0;
    const cost = hex.colonization_cost || 100;
    const percent = Math.min(100, Math.round((progress / cost) * 100));
	
	// Прогноз завершения (в ходах)
const pointsPerHex = Math.floor((country.colonization_points || 0) / (country.colonizing_hexes?.length || 1));
const turnsLeft = pointsPerHex > 0 ? Math.ceil((cost - progress) / pointsPerHex) : "∞";

    const hexDiv = document.createElement("div");
    hexDiv.className = "bg-[#2e2f3b] p-3 rounded-md";

    hexDiv.innerHTML = `
  <div class="flex justify-between items-center mb-2">
    <div class="text-base font-medium text-white">${hex.name || "Гекс:"} <span class="text-gray-400 text-sm">${hex.id}</span></div>
    <button class="text-red-400 hover:text-red-200 text-xs px-2 py-1 rounded border border-red-400" data-id="${hex.id}">Отменить</button>
  </div>

  <div class="mb-1 text-xs text-gray-300">Ваш прогресс: ${percent}% &nbsp;&nbsp; ⏳ ~${turnsLeft} ход(ов)</div>

  <div class="w-full bg-gray-800 rounded-full h-5 overflow-hidden mb-2">
    <div class="bg-green-500 h-5 transition-all duration-300 ease-in-out" style="width: ${percent}%"></div>
  </div>
`;

// 🔻 Добавим мини-прогресс-бары других стран
const others = Object.entries(hex.colonization || {})
  .filter(([key]) => key !== countryName);

if (others.length > 0) {
  const otherProgress = document.createElement("div");
  otherProgress.className = "space-y-1 mt-2";

  others.forEach(([other, val]) => {
    const p = Math.min(100, Math.round((val / cost) * 100));
    const bar = document.createElement("div");
    bar.innerHTML = `
      <div class="text-xs text-gray-400">${other}: ${p}%</div>
      <div class="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
        <div class="bg-yellow-500 h-2" style="width: ${p}%"></div>
      </div>
    `;
    otherProgress.appendChild(bar);
  });

  hexDiv.appendChild(otherProgress);
}

    container.appendChild(hexDiv);
  });

  document.getElementById("colonizationModal").classList.remove("hidden");

  // обработка кнопок "Отменить"
  container.querySelectorAll("button[data-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      const hexId = parseInt(btn.getAttribute("data-id"));
      cancelColonization(hexId, countryName);
      openColonizationModal(); // обновить окно
      if (window.redrawHexGrid) window.redrawHexGrid();
    });
  });
}

function cancelColonization(hexId, countryName) {
  const fs = require("fs");
  const path = require("path");

  const countryPath = path.join("data", "countries", countryName, `${countryName}.json`);
  const hexmapPath = path.join("data", "map", "hexmap.json");

  if (!fs.existsSync(countryPath) || !fs.existsSync(hexmapPath)) return;

  const country = JSON.parse(fs.readFileSync(countryPath, "utf-8"));
  const hexmap = JSON.parse(fs.readFileSync(hexmapPath, "utf-8"));

  country.colonizing_hexes = (country.colonizing_hexes || []).filter(id => id !== hexId);
  const hex = hexmap.find(h => h.id === hexId);
  if (hex?.colonization) {
    delete hex.colonization[countryName];
    if (Object.keys(hex.colonization).length === 0) delete hex.colonization;
  }

  fs.writeFileSync(countryPath, JSON.stringify(country, null, 2), "utf-8");
  fs.writeFileSync(hexmapPath, JSON.stringify(hexmap, null, 2), "utf-8");
}

window.openColonizationModal = openColonizationModal;
});
