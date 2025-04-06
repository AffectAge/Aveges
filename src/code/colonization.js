// colonization.js — логика прогресса колонизации
const fs = require("fs");
const path = require("path");

function updateColonizationProgress(state) {
  const hexmapPath = path.join("data", "map", "hexmap.json");
  const hexmap = JSON.parse(fs.readFileSync(hexmapPath, "utf-8"));

  const settingsPath = path.join("data", "colonization_settings.json");
  let settings = {
    default_colonization_points: 100,
    default_max_colonizations: 1,
    default_colonization_cost: 100
  };

  // Загружаем настройки или создаем при отсутствии
  if (!fs.existsSync(settingsPath)) {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
  } else {
    const existing = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    settings = { ...settings, ...existing };

    // Добавим недостающие ключи в файл
    let updated = false;
    for (let key in settings) {
      if (!(key in existing)) {
        existing[key] = settings[key];
        updated = true;
      }
    }
    if (updated) {
      fs.writeFileSync(settingsPath, JSON.stringify(existing, null, 2), "utf-8");
    }
    settings = existing;
  }

  state.countries.forEach(country => {
    const countryPath = path.join("data", "countries", country, `${country}.json`);
    if (!fs.existsSync(countryPath)) return;

    const countryData = JSON.parse(fs.readFileSync(countryPath, "utf-8"));
    const { colonization_points = 0, colonizing_hexes = [] } = countryData;

    if (colonizing_hexes.length === 0 || colonization_points === 0) return;

    const pointsPerHex = Math.floor(colonization_points / colonizing_hexes.length);

    colonizing_hexes.forEach(hexId => {
      const hex = hexmap.find(h => h.id === hexId);
      if (!hex || hex.owner) return;

      if (!hex.colonization) hex.colonization = {};
      if (!hex.colonization[country]) hex.colonization[country] = 0;

      hex.colonization[country] += pointsPerHex;

      const cost = typeof hex.colonization_cost === "number" ? hex.colonization_cost : settings.default_colonization_cost;

      if (typeof hex.colonization_cost !== "number") {
        hex.colonization_cost = settings.default_colonization_cost;
      }

      if (hex.colonization[country] >= cost) {
        hex.owner = country;
        delete hex.colonization;
        countryData.colonizing_hexes = countryData.colonizing_hexes.filter(id => id !== hexId);

        // Удаляем из других стран
        state.countries.forEach(other => {
          if (other === country) return;
          const otherPath = path.join("data", "countries", other, `${other}.json`);
          if (!fs.existsSync(otherPath)) return;

          const otherData = JSON.parse(fs.readFileSync(otherPath, "utf-8"));
          otherData.colonizing_hexes = (otherData.colonizing_hexes || []).filter(id => id !== hexId);
          fs.writeFileSync(otherPath, JSON.stringify(otherData, null, 2), "utf-8");
        });
      }
    });

    fs.writeFileSync(countryPath, JSON.stringify(countryData, null, 2), "utf-8");
  });

  fs.writeFileSync(hexmapPath, JSON.stringify(hexmap, null, 2), "utf-8");
}

module.exports = { updateColonizationProgress };