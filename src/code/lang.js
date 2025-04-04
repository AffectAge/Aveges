const fs = require('fs');
const path = require('path');

let translations = {};

function loadLang(lang = 'ru') {
  const filePath = path.join(__dirname, '../locales', lang + '.lang');
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach(line => {
    const match = line.match(/^\s*([A-Z0-9_]+):0\s+"(.+)"\s*$/);
    if (match) {
      const key = match[1];
      const value = match[2];
      translations[key] = value;
    }
  });
}

function t(key) {
  return translations[key] || key;
}

module.exports = { loadLang, t };