const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

const { loadGameState, nextTurn, saveGameState } = require('./code/state');
const { createBackup, listBackups, restoreBackup } = require('./code/backup');

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
    state = loadGameState();
	updateTurnDisplay(state);
    renderCountryDropdown(state);
  });

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
  function showCountryBudgetModal(incomeData, expenseData) {
    const totalIncome = incomeData.reduce((sum, i) => sum + i.value, 0);
    const totalExpenses = expenseData.reduce((sum, i) => sum + i.value, 0);
    const balance = totalIncome - totalExpenses;

    document.getElementById("totalIncome").textContent = totalIncome.toLocaleString();
    document.getElementById("totalExpenses").textContent = totalExpenses.toLocaleString();
    document.getElementById("balance").textContent = balance.toLocaleString();

    new Chart(document.getElementById("incomeChart"), {
      type: 'pie',
      data: {
        labels: incomeData.map(d => d.label),
        datasets: [{
          data: incomeData.map(d => d.value),
          backgroundColor: incomeData.map(d => d.color),
        }]
      },
      options: { responsive: true }
    });

    new Chart(document.getElementById("expenseChart"), {
      type: 'pie',
      data: {
        labels: expenseData.map(d => d.label),
        datasets: [{
          data: expenseData.map(d => d.value),
          backgroundColor: expenseData.map(d => d.color),
        }]
      },
      options: { responsive: true }
    });

    document.getElementById("countryBudgetModal").classList.remove("hidden");
  }
  
  document.getElementById("openBudgetButton").addEventListener("click", () => {
  // Здесь можно получить данные из файла, из объекта страны и т.д.
  // Примерные тестовые данные:
  const incomeData = [
    { label: "Налоги", value: 5000, color: "#4caf50" },
    { label: "Торговля", value: 3000, color: "#2196f3" },
    { label: "Гавани", value: 1000, color: "#00bcd4" },
  ];

  const expenseData = [
    { label: "Армия", value: 4000, color: "#f44336" },
    { label: "Инфраструктура", value: 2000, color: "#ff9800" },
    { label: "Администрация", value: 1500, color: "#9c27b0" },
  ];

  showCountryBudgetModal(incomeData, expenseData);
});

});
