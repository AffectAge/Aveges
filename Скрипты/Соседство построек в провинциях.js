/**
 * Рекурсивная функция для преобразования критериев province_required_buildings
 * в понятное и «живое» описание с поддержкой многоуровневых условий.
 * Поддерживаются операторы MIN_COUNT, MAX_COUNT, AND, OR, NOT, XNOR, IMPLIES.
 * @param {any} criteria - Критерий или условие.
 * @returns {string} - Человекочитаемое описание.
 */
function formatProvinceCriteriaPretty(criteria) {
  if (typeof criteria !== "object" || criteria === null || Object.keys(criteria).length === 0) {
    return "нет требований";
  }
  
  let parts = [];
  
  for (const key in criteria) {
    if (!criteria.hasOwnProperty(key)) continue;
    const value = criteria[key];
    
    switch (key) {
      case "MIN_COUNT":
        if (typeof value === "object" && value !== null) {
          let reqs = [];
          for (const building in value) {
            if (value.hasOwnProperty(building)) {
              reqs.push(`минимум ${value[building]} шт. «${building}»`);
            }
          }
          parts.push(reqs.join(" и "));
        }
        break;
      
      case "MAX_COUNT":
        if (typeof value === "object" && value !== null) {
          let reqs = [];
          for (const building in value) {
            if (value.hasOwnProperty(building)) {
              reqs.push(`не более ${value[building]} шт. «${building}»`);
            }
          }
          parts.push(reqs.join(" и "));
        }
        break;
      
      case "AND":
        if (Array.isArray(value)) {
          let subparts = value
            .map(sub => formatProvinceCriteriaPretty(sub))
            .filter(x => x !== "");
          if (subparts.length > 0) {
            parts.push(subparts.join("; "));
          }
        }
        break;
      
      case "OR":
        if (Array.isArray(value)) {
          let subparts = value
            .map(sub => formatProvinceCriteriaPretty(sub))
            .filter(x => x !== "");
          if (subparts.length > 0) {
            parts.push(`либо (${subparts.join(" или ")})`);
          }
        }
        break;
      
      case "NOT":
        if (Array.isArray(value)) {
          let subparts = value
            .map(sub => formatProvinceCriteriaPretty(sub))
            .filter(x => x !== "");
          if (subparts.length > 0) {
            parts.push(`отсутствие (${subparts.join(" или ")})`);
          }
        }
        break;
      
      case "XNOR":
        if (Array.isArray(value) && value.length === 2) {
          parts.push(`«${value[0]}» и «${value[1]}» должны присутствовать либо вместе, либо отсутствовать вместе`);
        }
        break;
      
      case "IMPLIES":
        if (Array.isArray(value) && value.length === 2) {
          parts.push(`если присутствует «${value[0]}», то должно быть «${value[1]}»`);
        }
        break;
      
      default:
        parts.push(`${key}: ${JSON.stringify(value)}`);
    }
  }
  
  return parts.join("; ");
}

/**
 * Функция для обновления списков matching_provinces_state и matching_provinces_others в шаблонах построек
 * на основе критериев province_required_buildings.
 * @param {Object} data - Объект с данными из именованных диапазонов
 * @param {Spreadsheet} spreadsheet - Объект активной таблицы
 * @returns {Array} newMessages - Массив новых сообщений для журнала
 */
function updateProvinceRequiredBuildings(data, spreadsheet) {
  let newMessages = [];

  try {
    // 1. Получение state_name из Переменные
    const variablesData = data['Переменные'];
    if (!variablesData || variablesData.length === 0 || !variablesData[0][0]) {
      newMessages.push(`❗ [Ошибка][updateProvinceRequiredBuildings] Переменные_ОсновнаяИнформация пусты или не содержат данных.`);
      return newMessages;
    }
    let stateName;
    try {
      const targetIdentifier = 'Основные данные государства';
      const targetRow = data['Переменные'].find(row => row[0] === targetIdentifier);
      if (targetRow && targetRow[1]) {
        const jsonMatch = targetRow[1].match(/\{.*\}/);
        if (jsonMatch) {
          const variablesJson = JSON.parse(jsonMatch[0]);
          stateName = variablesJson.state_name;
          if (!stateName) {
            newMessages.push(`❗ [Ошибка][updateProvinceRequiredBuildings] Ключ "state_name" не найден в Переменные.`);
            return newMessages;
          }
        } else {
          throw new Error('Не удалось извлечь JSON из содержимого Переменные.');
        }
      } else {
        throw new Error(`Идентификатор "${targetIdentifier}" не найден в Переменные.`);
      }
    } catch (e) {
      newMessages.push(`❗ [Ошибка][updateProvinceRequiredBuildings] Ошибка при парсинге JSON из Переменные: ${e.message}`);
      return newMessages;
    }

    // 2. Получение списка провинций
    const provincesData = data['Провинции_ОсновнаяИнформация'];
    if (!provincesData || provincesData.length === 0) {
      newMessages.push(`❗ [Ошибка][updateProvinceRequiredBuildings] Провинции_ОсновнаяИнформация пусты или не содержат данных.`);
      return newMessages;
    }
    const provinceMap = {}; // id -> province
    const stateProvinces = []; // Провинции нашего государства
    const otherProvinces = []; // Провинции других государств
    provincesData.forEach((row, index) => {
      const cell = row[0];
      if (cell) {
        try {
          const province = JSON.parse(cell);
          if (province.id) {
            provinceMap[province.id] = province;
            if (province.owner === stateName) {
              stateProvinces.push(province.id);
            } else {
              otherProvinces.push(province.id);
            }
          } else {
            newMessages.push(`❗ [Ошибка][updateProvinceRequiredBuildings] Провинция в строке ${index + 1} не содержит ключа "id".`);
          }
        } catch (e) {
          newMessages.push(`❗ [Ошибка][updateProvinceRequiredBuildings] Ошибка при парсинге JSON из Провинции_ОсновнаяИнформация, строка ${index + 1}: ${e.message}`);
        }
      }
    });

    // 3. Получение списка построек
    const buildingsData = data['Постройки_ОсновнаяИнформация'];
    if (!buildingsData || buildingsData.length === 0) {
      newMessages.push(`❗ [Ошибка][updateProvinceRequiredBuildings] Постройки_ОсновнаяИнформация пусты или не содержат данных.`);
      return newMessages;
    }
    // Подсчет построек по типам для каждой провинции
    // Структура: { province_id: { building_name: count } }
    const buildingCountsByProvince = {};
    buildingsData.forEach((row, index) => {
      const cell = row[0];
      if (cell) {
        try {
          const parsedData = JSON.parse(cell);
          const buildingsArray = Array.isArray(parsedData) ? parsedData : [parsedData];
          buildingsArray.forEach((building, bIndex) => {
            const buildingName = building.building_name;
            const provinceId = building.province_id;
            if (!buildingName || !provinceId) {
              newMessages.push(`❗ [Ошибка][updateProvinceRequiredBuildings] Здание (строка ${index + 1}, элемент ${bIndex + 1}) не содержит "building_name" или "province_id".`);
              return;
            }
            if (!buildingCountsByProvince[provinceId]) {
              buildingCountsByProvince[provinceId] = {};
            }
            buildingCountsByProvince[provinceId][buildingName] = (buildingCountsByProvince[provinceId][buildingName] || 0) + 1;
          });
        } catch (e) {
          newMessages.push(`❗ [Ошибка][updateProvinceRequiredBuildings] Ошибка при парсинге Постройки_ОсновнаяИнформация, строка ${index + 1}: ${e.message}`);
        }
      }
    });

    // 4. Получение списка шаблонов построек
    const templatesData = data['Постройки_Шаблоны'];
    if (!templatesData || templatesData.length === 0) {
      newMessages.push(`❗ [Ошибка][updateProvinceRequiredBuildings] Постройки_Шаблоны пусты или не содержат данных.`);
      return newMessages;
    }
    const templates = [];
    templatesData.forEach((row, index) => {
      const cell = row[0];
      if (cell) {
        try {
          const template = JSON.parse(cell);
          if (!template.name) {
            newMessages.push(`❗ [Ошибка][updateProvinceRequiredBuildings] Шаблон (строка ${index + 1}) не содержит "name".`);
            return;
          }
          if (!template.province_required_buildings) {
            newMessages.push(`❗ [Ошибка][updateProvinceRequiredBuildings] Шаблон "${template.name}" (строка ${index + 1}) не содержит "province_required_buildings".`);
            return;
          }
          if (!template.matching_provinces_state) {
            newMessages.push(`❗ [Ошибка][updateProvinceRequiredBuildings] Шаблон "${template.name}" (строка ${index + 1}) не содержит "matching_provinces_state".`);
            return;
          }
          if (!template.matching_provinces_others) {
            newMessages.push(`❗ [Ошибка][updateProvinceRequiredBuildings] Шаблон "${template.name}" (строка ${index + 1}) не содержит "matching_provinces_others".`);
            return;
          }
          templates.push({ data: template, row: index });
        } catch (e) {
          newMessages.push(`❗ [Ошибка][updateProvinceRequiredBuildings] Ошибка при парсинге Постройки_Шаблоны, строка ${index + 1}: ${e.message}`);
        }
      }
    });
    if (templates.length === 0) {
      newMessages.push(`❗ [Ошибка][updateProvinceRequiredBuildings] Нет корректных шаблонов для обработки в Постройки_Шаблоны.`);
      return newMessages;
    }

    // 5. Обработка каждого шаблона
    templates.forEach(templateInfo => {
      const template = templateInfo.data;
      const templateName = template.name;
      const provinceCriteria = template.province_required_buildings;
      
      if (typeof provinceCriteria !== 'object' || provinceCriteria === null) {
        newMessages.push(`❗ [Ошибка][updateProvinceRequiredBuildings] Шаблон "${templateName}" имеет некорректные критерии в "province_required_buildings".`);
        return;
      }
      
      // Вычисляем критерии для провинций нашего государства и других
      const matchingProvincesState = [];
      const matchingProvincesOthers = [];
      
      stateProvinces.forEach(provinceId => {
        const counts = buildingCountsByProvince[provinceId] || {};
        if (evaluateCriteria(provinceCriteria, counts)) {
          matchingProvincesState.push(provinceId);
        }
      });
      otherProvinces.forEach(provinceId => {
        const counts = buildingCountsByProvince[provinceId] || {};
        if (evaluateCriteria(provinceCriteria, counts)) {
          matchingProvincesOthers.push(provinceId);
        }
      });
      
      // Формируем строку описания требований
      const criteriaDescription = formatProvinceCriteriaPretty(provinceCriteria);
      
      // Если ни одна провинция не соответствует критериям, выводим подробное сообщение
      if (matchingProvincesState.length === 0 && matchingProvincesOthers.length === 0) {
        newMessages.push(`🚫 [Постройки][Необходимые постройки в провинции] Шаблон "${templateName}" не имеет ни одной провинции, удовлетворяющей требованиям: ${criteriaDescription} ❌.`);
      }
      
      // Если уже существуют привязанные провинции, сравниваем их с новыми значениями
      const currentMatchingState = template.matching_provinces_state || [];
      const currentMatchingOthers = template.matching_provinces_others || [];
      
      const provincesToRemoveState = currentMatchingState.filter(id => !matchingProvincesState.includes(id));
      if (provincesToRemoveState.length > 0) {
        template.matching_provinces_state = currentMatchingState.filter(id => matchingProvincesState.includes(id));
        const provinceList = provincesToRemoveState.join(', ');
        newMessages.push(`🗺️ [Постройки][Провинции] Наши провинции (${provinceList}) больше не подходят для "${templateName}" из-за несоответствия требованиям: ${criteriaDescription} 🧹.`);
      }
      const provincesToRemoveOthers = currentMatchingOthers.filter(id => !matchingProvincesOthers.includes(id));
      if (provincesToRemoveOthers.length > 0) {
        template.matching_provinces_others = currentMatchingOthers.filter(id => matchingProvincesOthers.includes(id));
        const provinceList = provincesToRemoveOthers.join(', ');
        newMessages.push(`🌐 [Постройки][Провинции] Провинции других стран (${provinceList}) больше не подходят для "${templateName}" из-за несоответствия требованиям: ${criteriaDescription} 🧹.`);
      }
      
      // Обновление шаблона в data
      try {
        data['Постройки_Шаблоны'][templateInfo.row][0] = JSON.stringify(template);
      } catch (e) {
        newMessages.push(`❗ [Ошибка][updateProvinceRequiredBuildings] Ошибка при сериализации JSON для шаблона "${templateName}" (строка ${templateInfo.row + 1}): ${e.message}`);
      }
    });
    
  } catch (error) {
    newMessages.push(`🔥 [Ошибка][updateProvinceRequiredBuildings] ${error.message}`);
  }
  
  return newMessages;
}

/**
 * Функция для оценки соответствия провинции критериям
 * @param {Object} criteria - Критерии из province_required_buildings
 * @param {Object} buildingCounts - Объект с количеством построек по типам в провинции
 * @returns {Boolean} - Возвращает true, если провинция соответствует критериям (или критерии отсутствуют), иначе false
 */
function evaluateCriteria(criteria, buildingCounts) {
  if (typeof criteria !== 'object' || criteria === null || Object.keys(criteria).length === 0) {
    return true;
  }
  for (const operator in criteria) {
    if (!criteria.hasOwnProperty(operator)) continue;
    const value = criteria[operator];
    switch (operator) {
      case 'AND':
        if (!Array.isArray(value)) return false;
        return value.every(sub => evaluateCriteria(sub, buildingCounts));
      case 'OR':
        if (!Array.isArray(value)) return false;
        return value.some(sub => evaluateCriteria(sub, buildingCounts));
      case 'NOT':
        if (!Array.isArray(value)) return false;
        return !value.some(sub => evaluateCriteria(sub, buildingCounts));
      case 'MIN_COUNT':
        if (typeof value !== 'object') return false;
        for (const building in value) {
          if (!value.hasOwnProperty(building)) continue;
          if ((buildingCounts[building] || 0) < value[building]) return false;
        }
        return true;
      case 'MAX_COUNT':
        if (typeof value !== 'object') return false;
        for (const building in value) {
          if (!value.hasOwnProperty(building)) continue;
          if ((buildingCounts[building] || 0) > value[building]) return false;
        }
        return true;
      case 'XNOR':
        if (!Array.isArray(value) || value.length !== 2) return false;
        const [first, second] = value;
        return ((buildingCounts[first] || 0) > 0) === ((buildingCounts[second] || 0) > 0);
      case 'IMPLIES':
        if (!Array.isArray(value) || value.length !== 2) return false;
        const [antecedent, consequent] = value;
        return !((buildingCounts[antecedent] || 0) > 0) || ((buildingCounts[consequent] || 0) > 0);
      default:
        return false;
    }
  }
  return true;
}
