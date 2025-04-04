
const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

const { loadLang, t } = require('./code/lang');
const { loadGameState, nextTurn, saveGameState } = require('./code/state');
const { createBackup, listBackups, restoreBackup } = require('./code/backup');

let currentLang = localStorage.getItem('lang') || 'ru';

function applyTranslation(state) {
  document.getElementById('turn-display').innerText = state.turn;
  document.getElementById('end-turn').innerText = t('END_TURN');
  document.getElementById('lang-select').value = currentLang;
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

function openAddCountryModal() {
  document.getElementById('add-country-modal').classList.remove('hidden');
}

function closeAddCountryModal() {
  document.getElementById('add-country-modal').classList.add('hidden');
}

window.addEventListener('DOMContentLoaded', () => {
  loadLang(currentLang);
  let state = loadGameState();
  applyTranslation(state);
  renderCountryDropdown(state);

  document.getElementById('end-turn').addEventListener('click', () => {
    nextTurn();
    state = loadGameState();
    applyTranslation(state);
    renderCountryList(state);
  });

// Выпадающий список для выбора или создания страны
  function renderCountryDropdown(state) {
  const dropdown = document.getElementById('dropdown-menu');
  const label = document.getElementById('current-country-label');
  dropdown.innerHTML = '';

  label.textContent = state.current_country || 'Выбрать страну';

  state.countrys.forEach(country => {
    const row = document.createElement('div');
    row.className = 'flex justify-between items-center bg-[#3a3e4a] hover:bg-[#4a4e5a] px-2 py-1 rounded text-sm text-white cursor-pointer';

    const nameBtn = document.createElement('button');
    nameBtn.textContent = country;
    nameBtn.className = 'text-left flex-1';
    nameBtn.onclick = () => {
      const s = loadGameState();
      s.current_country = country;
      saveGameState(s);
      renderCountryDropdown(s);
      dropdown.classList.add('hidden');
    };

    const delBtn = document.createElement('button');
    delBtn.textContent = '🗑️';
    delBtn.className = 'text-red-400 hover:text-red-600 px-1';
    delBtn.onclick = (e) => {
      e.stopPropagation();
      if (!confirm(`Удалить страну "${country}"?`)) return;
      const s = loadGameState();
      s.countrys = s.countrys.filter(c => c !== country);
      if (s.current_country === country) {
        s.current_country = s.countrys[0] || '';
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
  const name = input.value.trim();

  if (!name) {
    error.textContent = "Введите название страны";
    error.classList.remove('hidden');
    return;
  }

  const s = loadGameState();
  if (s.countrys.includes(name)) {
    error.textContent = "Такая страна уже есть";
    error.classList.remove('hidden');
    input.select();
    return;
  }

  // всё ок — добавляем
  s.countrys.push(name);
  s.current_country = name;
  saveGameState(s);

  input.value = '';
  error.classList.add('hidden');
  closeAddCountryModal();
  renderCountryDropdown(s);
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
});
