/**
 * Рекурсивная функция для преобразования критериев state_required_buildings 
 * в понятное описание с указанием необходимых и недопустимых построек.
 * Поддерживаются операторы MIN_COUNT, MAX_COUNT, AND, OR, NOT, XNOR, IMPLIES.
 * @param {any} criteria - Критерий или условие.
 * @returns {string} - Человекочитаемое описание.
 */
/**
 * Рекурсивная функция для преобразования критериев state_required_buildings 
 * в понятное и «живое» описание с поддержкой многоуровневых условий.
 * Поддерживаются операторы MIN_COUNT, MAX_COUNT, AND, OR, NOT, XNOR, IMPLIES.
 * @param {any} criteria - Критерий или условие.
 * @returns {string} - Человекочитаемое описание.
 */
function formatStateCriteriaPretty(criteria) {
  if (typeof criteria !== "object" || criteria === null || Object.keys(criteria).length === 0) {
    return "";
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
              reqs.push(`требуется минимум 📊 ${value[building]} 🏭 ${building}`);
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
              reqs.push(`не более 📊 ${value[building]} 🏭 ${building}`);
            }
          }
          parts.push(reqs.join(" и "));
        }
        break;
      
      case "AND":
        if (Array.isArray(value)) {
          let subparts = value
            .map(sub => formatStateCriteriaPretty(sub))
            .filter(x => x !== "");
          if (subparts.length > 0) {
            parts.push(subparts.join("\n ➤ "));
          }
        }
        break;
      
      case "OR":
        if (Array.isArray(value)) {
          let subparts = value
            .map(sub => formatStateCriteriaPretty(sub))
            .filter(x => x !== "");
          if (subparts.length > 0) {
            parts.push(`либо ${subparts.join(" или ")}`);
          }
        }
        break;
      
      case "NOT":
        if (Array.isArray(value)) {
          let subparts = value
            .map(sub => formatStateCriteriaPretty(sub))
            .filter(x => x !== "");
          if (subparts.length > 0) {
            parts.push(`отсутствие ${subparts.join(" или ")}`);
          }
        }
        break;
      
      case "XNOR":
        if (Array.isArray(value) && value.length === 2) {
          parts.push(`🏭 ${value[0]} и 🏭 ${value[1]} должны присутствовать либо вместе, либо отсутствовать вместе`);
        }
        break;
      
      case "IMPLIES":
        if (Array.isArray(value) && value.length === 2) {
          parts.push(`если присутствует 🏭 ${value[0]}, то должно быть 🏭 ${value[1]}`);
        }
        break;
      
      default:
        parts.push(`${key}: ${JSON.stringify(value)}`);
    }
  }
  
  return parts.join("; ");
}



/**
 * Функция для обновления состояния в шаблонах построек на основе критериев state_required_buildings
 * с выводом подробного сообщения о требованиях.
 * @param {Object} data - Объект с данными из именованных диапазонов
 * @param {Spreadsheet} spreadsheet - Объект активной таблицы
 * @returns {Array} newMessages - Массив новых сообщений для журнала
 */
function updateStateRequiredBuildings(data, spreadsheet) {
  let newMessages = [];

  try {
    // Получение state_name из Переменные
    const variablesData = data['Переменные'];
    if (!variablesData || variablesData.length === 0 || !variablesData[0][0]) {
      newMessages.push(`❗ [Ошибка][updateStateRequiredBuildings] Переменные пусты или не содержат данных.`);
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
            newMessages.push(`❗ [Ошибка][updateStateRequiredBuildings] Ключ "state_name" не найден в Переменные.`);
            return newMessages;
          }
        } else {
          throw new Error('Не удалось извлечь JSON из содержимого Переменные.');
        }
      } else {
        throw new Error(`Идентификатор "${targetIdentifier}" не найден в Переменные.`);
      }
    } catch (e) {
      newMessages.push(`❗ [Ошибка][updateStateRequiredBuildings] Ошибка при парсинге JSON из Переменные: ${e.message}`);
      return newMessages;
    }
    // Получение и парсинг провинций
    const provincesData = data['Провинции_ОсновнаяИнформация'];
    if (!provincesData || provincesData.length === 0) {
      newMessages.push(`❗ [Ошибка][updateStateRequiredBuildings] Провинции_ОсновнаяИнформация пусты или не содержат данных.`);
      return newMessages;
    }
    const provinceMap = {};
    const stateProvinces = [];
    provincesData.forEach((row, index) => {
      const cell = row[0];
      if (cell) {
        try {
          const province = JSON.parse(cell);
          if (province.id && province.owner) {
            provinceMap[province.id] = province.owner;
            if (province.owner === stateName) {
              stateProvinces.push(province.id);
            }
          } else {
            newMessages.push(`❗ [Ошибка][updateStateRequiredBuildings] Провинция (строка ${index + 1}) не содержит "id" или "owner".`);
          }
        } catch (e) {
          newMessages.push(`❗ [Ошибка][updateStateRequiredBuildings] Ошибка при парсинге Провинции_ОсновнаяИнформация, строка ${index + 1}: ${e.message}`);
        }
      }
    });
    // Получение построек и подсчет по типам
    const buildingsData = data['Постройки_ОсновнаяИнформация'];
    if (!buildingsData || buildingsData.length === 0) {
      newMessages.push(`❗ [Ошибка][updateStateRequiredBuildings] Постройки_ОсновнаяИнформация пусты или не содержат данных.`);
      return newMessages;
    }
    const buildingCounts = {};
    buildingsData.forEach((row, index) => {
      const cell = row[0];
      if (!cell) return;
      try {
        const parsedData = JSON.parse(cell);
        const buildingsArray = Array.isArray(parsedData) ? parsedData : [parsedData];
        buildingsArray.forEach((building, idx) => {
          const buildingName = building.building_name;
          const provinceId = building.province_id;
          if (!buildingName || !provinceId) {
            newMessages.push(`❗ [Ошибка][updateStateRequiredBuildings] Постройка (строка ${index + 1}, элемент ${idx + 1}) не содержит "building_name" или "province_id".`);
            return;
          }
          if (provinceMap[provinceId] === stateName) {
            buildingCounts[buildingName] = (buildingCounts[buildingName] || 0) + 1;
          }
        });
      } catch (e) {
        newMessages.push(`❗ [Ошибка][updateStateRequiredBuildings] Ошибка при парсинге Постройки_ОсновнаяИнформация, строка ${index + 1}: ${e.message}`);
      }
    });
    // Получение шаблонов построек
    const templatesData = data['Постройки_Шаблоны'];
    if (!templatesData || templatesData.length === 0) {
      newMessages.push(`❗ [Ошибка][updateStateRequiredBuildings] Постройки_Шаблоны пусты или не содержат данных.`);
      return newMessages;
    }
    const templates = [];
    templatesData.forEach((row, index) => {
      const cell = row[0];
      if (cell) {
        try {
          const template = JSON.parse(cell);
          if (!template.name) {
            newMessages.push(`❗ [Ошибка][updateStateRequiredBuildings] Шаблон (строка ${index + 1}) не содержит "name".`);
            return;
          }
          if (!template.state_required_buildings) {
            newMessages.push(`❗ [Ошибка][updateStateRequiredBuildings] Шаблон "${template.name}" (строка ${index + 1}) не содержит "state_required_buildings".`);
            return;
          }
          if (!template.matching_provinces_state) {
            newMessages.push(`❗ [Ошибка][updateStateRequiredBuildings] Шаблон "${template.name}" (строка ${index + 1}) не содержит "matching_provinces_state".`);
            return;
          }
          if (!template.matching_provinces_others) {
            newMessages.push(`❗ [Ошибка][updateStateRequiredBuildings] Шаблон "${template.name}" (строка ${index + 1}) не содержит "matching_provinces_others".`);
            return;
          }
          templates.push({ data: template, row: index });
        } catch (e) {
          newMessages.push(`❗ [Ошибка][updateStateRequiredBuildings] Ошибка при парсинге Постройки_Шаблоны, строка ${index + 1}: ${e.message}`);
        }
      }
    });
    if (templates.length === 0) {
      newMessages.push(`❗ [Ошибка][updateStateRequiredBuildings] Нет корректных шаблонов для обработки в Постройки_Шаблоны.`);
      return newMessages;
    }
    // Обработка каждого шаблона с выводом подробного описания критериев
    templates.forEach(templateInfo => {
      const template = templateInfo.data;
      const templateName = template.name;
      const stateCriteria = template.state_required_buildings;
      if (typeof stateCriteria === 'object' && stateCriteria !== null && Object.keys(stateCriteria).length === 0) {
        newMessages.push(`✅ [Постройки][Необходимые постройки в государстве] Постройка 🏭 ${templateName} соответствует требованиям наличия построек в государстве так как их у постройки нет. \n`);
        return;
      }
      const isMatching = evaluateStateCriteria(stateCriteria, buildingCounts);
      const criteriaDescription = formatStateCriteriaPretty(stateCriteria);
      if (isMatching) {
        newMessages.push(`🏗️ [Постройки][Необходимые постройки в государстве] Постройка 🏭 ${templateName} соответствует требованиям наличия построек в государстве ✅.`);
      } else {
        newMessages.push(`❌ [Постройки][Необходимые постройки в государстве] Шаблон 🏭 ${templateName} не соответствует требованиям: \n ➤ ${criteriaDescription} \n`);
        // При необходимости очищаем списки провинций
        if (template.matching_provinces_state && template.matching_provinces_state.length > 0) {
          const removedProvinces = template.matching_provinces_state.join(', ');
          template.matching_provinces_state = [];
          newMessages.push(`🗺️ Провинции нашего государства 📌 ${removedProvinces} больше не подходят для постройки 🏭 ${templateName} 🧹.`);
        }
        if (template.matching_provinces_others && template.matching_provinces_others.length > 0) {
          const removedProvinces = template.matching_provinces_others.join(', ');
          template.matching_provinces_others = [];
          newMessages.push(`🌐 Провинции других стран 📌 ${removedProvinces} больше не подходят для постройки 🏭 ${templateName} 🧹.`);
        }
        data['Постройки_Шаблоны'][templateInfo.row][0] = JSON.stringify(template);
      }
    });

  } catch (error) {
    newMessages.push(`🔥 [Ошибка][updateStateRequiredBuildings] ${error.message}`);
  }
  return newMessages;
}

/**
 * Функция для оценки соответствия состояния государства критериям
 * @param {Object} criteria - Критерии из state_required_buildings
 * @param {Object} buildingCounts - Объект с общим количеством построек по типам во всех провинциях государства
 * @returns {Boolean} - Возвращает true, если критерии выполнены, иначе false
 */
function evaluateStateCriteria(criteria, buildingCounts) {
  if (typeof criteria !== 'object' || criteria === null) {
    return false;
  }
  if (Object.keys(criteria).length === 0) {
    return true;
  }
  for (const operator in criteria) {
    if (!criteria.hasOwnProperty(operator)) continue;
    const value = criteria[operator];
    switch (operator) {
      case 'AND':
        if (!Array.isArray(value)) return false;
        return value.every(subCriteria => evaluateStateCriteria(subCriteria, buildingCounts));
      case 'OR':
        if (!Array.isArray(value)) return false;
        return value.some(subCriteria => evaluateStateCriteria(subCriteria, buildingCounts));
      case 'NOT':
        if (!Array.isArray(value)) return false;
        return !value.some(subCriteria => evaluateStateCriteria(subCriteria, buildingCounts));
      case 'MIN_COUNT':
        if (typeof value !== 'object') return false;
        for (const building in value) {
          if (!value.hasOwnProperty(building)) continue;
          const minCount = value[building];
          if ((buildingCounts[building] || 0) < minCount) return false;
        }
        return true;
      case 'MAX_COUNT':
        if (typeof value !== 'object') return false;
        for (const building in value) {
          if (!value.hasOwnProperty(building)) continue;
          const maxCount = value[building];
          if ((buildingCounts[building] || 0) > maxCount) return false;
        }
        return true;
      case 'XNOR':
        if (!Array.isArray(value) || value.length !== 2) return false;
        {
          const [first, second] = value;
          const firstExists = (buildingCounts[first] || 0) > 0;
          const secondExists = (buildingCounts[second] || 0) > 0;
          return firstExists === secondExists;
        }
      case 'IMPLIES':
        if (!Array.isArray(value) || value.length !== 2) return false;
        {
          const [antecedent, consequent] = value;
          const antecedentExists = (buildingCounts[antecedent] || 0) > 0;
          const consequentExists = (buildingCounts[consequent] || 0) > 0;
          return !antecedentExists || consequentExists;
        }
      default:
        return false;
    }
  }
  return false;
}
