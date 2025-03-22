/**
 * Функция для обработки ограничений построек по мировому лимиту
 * @param {Object} data - Объект с данными из именованных диапазонов
 * @param {Sheet} sheet - Активный лист
 * @param {Spreadsheet} spreadsheet - Активная таблица
 * @returns {Array} newMessages - Массив новых сообщений для журнала
 */
function processWorldLimits(data, sheet, spreadsheet) {
  let newMessages = [];
  
  try {
    // 1. Получение state_name из Переменные
    const variablesData = data['Переменные'];
    if (!variablesData || variablesData.length === 0 || !variablesData[0][0]) {
      newMessages.push(`❗ [Ошибка][processWorldLimits] Переменные пуст или не содержит данных.`);
      return newMessages;
    }
    
    // 1. Получение state_name из Переменные
let stateName;
try {
  const targetIdentifier = 'Основные данные государства';
  
  // Ищем строку с нужным идентификатором
  const targetRow = data['Переменные'].find(row => row[0] === targetIdentifier);
  
  if (targetRow && targetRow[1]) {
    // Извлекаем JSON из второго столбца
    const jsonMatch = targetRow[1].match(/\{.*\}/);
    if (jsonMatch) {
      const variablesJson = JSON.parse(jsonMatch[0]);
      stateName = variablesJson.state_name;
      
      if (!stateName) {
        newMessages.push(`❗ [Ошибка][processWorldLimits] Ключ "state_name" не найден в Переменные.`);
        return newMessages;
      }
    } else {
      throw new Error('Не удалось извлечь JSON из содержимого Переменные.');
    }
  } else {
    throw new Error(`Идентификатор "${targetIdentifier}" не найден в Переменные.`);
  }
} catch (e) {
  newMessages.push(`❗ [Ошибка][processWorldLimits] Ошибка при парсинге JSON из Переменные: ${e.message}`);
  return newMessages;
}
    
    // 2. Получение списка провинций
    const provincesData = data['Провинции_ОсновнаяИнформация'];
    if (!provincesData || provincesData.length === 0) {
      newMessages.push(`❗ [Ошибка][processWorldLimits] Провинции_ОсновнаяИнформация пуст или не содержит данных.`);
      return newMessages;
    }
    
    // Парсинг провинций
    const provinceMap = {}; // id -> owner
    provincesData.forEach((row, index) => {
      const cell = row[0];
      if (cell) {
        try {
          let jsonString = cell;
          
          // Удаляем внешние кавычки, если они есть
          if (jsonString.startsWith('"') && jsonString.endsWith('"')) {
            jsonString = jsonString.slice(1, -1);
          }
          
          // Заменяем двойные кавычки на одинарные
          jsonString = jsonString.replace(/""/g, '"');
          
          const province = JSON.parse(jsonString);
          if (province.id && province.owner) {
            provinceMap[province.id] = province.owner;
          } else {
            newMessages.push(`❗ [Ошибка][processWorldLimits] Провинция в строке ${index + 1} не содержит ключей "id" или "owner".`);
          }
        } catch (e) {
          newMessages.push(`❗ [Ошибка][processWorldLimits] Ошибка при парсинге JSON из Провинции_ОсновнаяИнформация, строка ${index + 1}: ${e.message}`);
        }
      }
    });
    
    // 3. Получение списка построек
    const buildingsData = data['Постройки_ОсновнаяИнформация'];
    if (!buildingsData || buildingsData.length === 0) {
      newMessages.push(`❗ [Ошибка][processWorldLimits] Постройки_ОсновнаяИнформация пуст или не содержит данных.`);
      return newMessages;
    }
    
    // Подсчет построек в мире
    // Структура: { building_name: count }
    const buildingCounts = {};
    buildingsData.forEach((row, index) => {
      const cell = row[0];
      if (cell) {
        try {
          const parsedData = JSON.parse(cell);
          
          // **Изменение: Поддержка нескольких зданий в одной ячейке**
          const buildingsArray = Array.isArray(parsedData) ? parsedData : [parsedData];
          
          buildingsArray.forEach((building, bIndex) => {
            const buildingName = building.building_name;
            const provinceId = building.province_id;
            
            if (!buildingName || !provinceId) {
              newMessages.push(`❗ [Ошибка][processWorldLimits] Здание в строке ${index + 1}, элемент ${bIndex + 1} не содержит ключи "building_name" или "province_id".`);
              return;
            }
            
            if (!buildingCounts[buildingName]) {
              buildingCounts[buildingName] = 0;
            }
            
            buildingCounts[buildingName] += 1;
          });
          // **Конец изменения**
        } catch (e) {
          newMessages.push(`❗ [Ошибка][processWorldLimits] Ошибка при парсинге JSON из Постройки_ОсновнаяИнформация, строка ${index + 1}: ${e.message}`);
        }
      }
    });
    
    // 4. Получение списка шаблонов построек
    const templatesData = data['Постройки_Шаблоны'];
    if (!templatesData || templatesData.length === 0) {
      newMessages.push(`❗ [Ошибка][processWorldLimits] Постройки_Шаблоны пуст или не содержит данных.`);
      return newMessages;
    }
    
    // Парсинг шаблонов
    const templates = []; // { data: templateObject, row: rowIndex }
    templatesData.forEach((row, index) => {
      const cell = row[0];
      if (cell) {
        try {
          const template = JSON.parse(cell);
          if (!template.name) {
            newMessages.push(`❗ [Ошибка][processWorldLimits] Шаблон в строке ${index + 1} не содержит ключа "name".`);
            return;
          }
          if (template.world_limit === undefined || template.world_limit === null) {
            newMessages.push(`❗ [Ошибка][processWorldLimits] Шаблон "${template.name}" в строке ${index + 1} не содержит ключа "world_limit".`);
            return;
          }
          templates.push({ data: template, row: index });
        } catch (e) {
          newMessages.push(`❗ [Ошибка][processWorldLimits] Ошибка при парсинге JSON из Постройки_Шаблоны, строка ${index + 1}: ${e.message}`);
        }
      }
    });
    
    if (templates.length === 0) {
      newMessages.push(`❗ [Ошибка][processWorldLimits] Нет корректных шаблонов в Постройки_Шаблоны для обработки.`);
      return newMessages;
    }
    
    // 5. Объект сопоставления ключей к понятным фразам
    const listKeyDescriptions = {
      'allowed_building_state': 'в наших провинциях',
      'allowed_building_others': 'в провинциях других государств'
    };
    
    // 6. Обработка каждого шаблона
    templates.forEach(templateInfo => {
      const template = templateInfo.data;
      const templateName = template.name;
      const worldLimit = template.world_limit;
      
      if (typeof worldLimit !== 'number' || worldLimit < -1) {
        newMessages.push(`❗ [Ошибка][processWorldLimits] Шаблон "${templateName}" имеет недопустимое значение "world_limit": ${worldLimit}. Допустимы значения -1 или больше.`);
        return;
      }
      
      // Получаем общее количество построек данного типа
      const totalBuildings = buildingCounts[templateName] || 0;
      
      if (worldLimit !== -1 && totalBuildings >= worldLimit) {
        // Если лимит достигнут или превышен, удаляем все провинции из allowed_building_state и allowed_building_others
        ['allowed_building_state', 'allowed_building_others'].forEach(listKey => {
          if (Array.isArray(template[listKey]) && template[listKey].length > 0) {
            const removedProvinces = [...template[listKey]]; // Копируем текущий список
            
            // Очищаем список
            template[listKey] = [];
            
            // Генерируем сообщение о удалении провинций
            const provinceIds = removedProvinces.join(', ');
            
            const description = listKeyDescriptions[listKey] || listKey;
            newMessages.push(`[Критерии строительства][Лимит построек на мир] Постройка 🏭 ${templateName} больше не может быть построена ${description}: 📌 ${provinceIds} из-за достигнутого максимального количества данной постройки для мира. Лимит: 📊 ${worldLimit} на мир. Построено: 📊 ${totalBuildings}. \n`);
          }
        });
        
        // Обновляем шаблон в data
        try {
          data['Постройки_Шаблоны'][templateInfo.row][0] = JSON.stringify(template);
        } catch (e) {
          newMessages.push(`❗ [Ошибка][processWorldLimits] Ошибка при сериализации JSON для шаблона "${templateName}" в строке ${templateInfo.row + 1}: ${e.message}`);
        }
      }
    });

  } catch (error) {
    newMessages.push(`❗ [Ошибка][processWorldLimits] processWorldLimits: ${error.message}`);
  }
  
  return newMessages;
}
