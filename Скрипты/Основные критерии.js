/**
 * Маппинг для описания критериев с эмодзи
 */
const CRITERIA_DETAILS = {
  required_landscapes: { label: "ландшафта", emoji: "🏞" },
  required_planet: { label: "планеты", emoji: "🪐" },
  required_culture: { label: "культуры", emoji: "🎭" },
  required_religion: { label: "религии", emoji: "🙏" },
  required_climate: { label: "климата", emoji: "☀️" },
  required_radiation: { label: "радиации", emoji: "☢️" },
  required_pollution: { label: "загрязнения", emoji: "♻️" },
  required_stability: { label: "стабильности", emoji: "⚖️" },
};

/**
 * Рекурсивная функция для форматирования критериев в человекочитаемый текст.
 * Обрабатывает как простые, так и вложенные (многоуровневые) объекты критериев.
 * @param {any} condition - Условие (строка, число или объект с оператором)
 * @returns {string} - Форматированный текст условия
 */
function formatCriteria(condition) {
  if (typeof condition === "string" || typeof condition === "number") {
    return condition.toString();
  }
  if (typeof condition === "object" && condition !== null) {
    const keys = Object.keys(condition);
    if (keys.length !== 1) {
      // Если условий несколько на одном уровне, возвращаем JSON как запасной вариант
      return JSON.stringify(condition);
    }
    const operator = keys[0].toUpperCase();
    const operand = condition[keys[0]];
    // Если операнд — массив, форматируем каждый элемент рекурсивно
    if (Array.isArray(operand)) {
  // Специальный случай для BETWEEN с двумя значениями
  if (operator === "BETWEEN" && operand.length === 2) {
    return `от ${operand[0]} до ${operand[1]}`;
  }

  const formattedOperands = operand.map(item => formatCriteria(item));
  switch (operator) {
    case "AND":
      return formattedOperands.join(" и ");
    case "OR":
    case "XOR":
      return formattedOperands.join(" или ");
    case "NOT":
      return "не " + formattedOperands[0];
    default:
      return operator + " " + formattedOperands.join(", ");
  }
} else {
      // Если операнд не массив, форматируем его рекурсивно
      const formattedOperand = formatCriteria(operand);
      if (operator === "NOT") {
        return "не " + formattedOperand;
      } else if (operator === "GREATER_THAN") {
        return "больше " + formattedOperand;
      } else if (operator === "LESS_THAN") {
        return "меньше " + formattedOperand;
      } else if (operator === "EQUAL_TO") {
        return "равно " + formattedOperand;
      } else if (operator === "GREATER_OR_EQUAL_TO") {
        return "не меньше " + formattedOperand;
      } else if (operator === "LESS_OR_EQUAL_TO") {
        return "не больше " + formattedOperand;
      } else if (operator === "BETWEEN" && Array.isArray(operand) && operand.length === 2) {
        return `от ${operand[0]} до ${operand[1]}`;
      }
      return operator + " " + formattedOperand;
    }
  }
  return "";
}

/**
 * Функция для генерации подробного сообщения по конкретному критерию с эмодзи.
 * Теперь используется функция formatCriteria для обработки многоуровневых условий.
 * @param {Object} checkField - объект из CHECK_FIELDS
 * @param {Object} buildingCondition - условие из шаблона постройки
 * @param {any} provinceValue - значение из провинции
 * @returns {string} - подробное сообщение для данного критерия
 */
function generateDetailedReason(checkField, buildingCondition, provinceValue) {
  const detail = CRITERIA_DETAILS[checkField.buildingKey] || { label: checkField.buildingKey, emoji: "" };
  
  // Рекурсивное форматирование условия
  const requiredText = formatCriteria(buildingCondition);
  const provinceText = Array.isArray(provinceValue) ? provinceValue.join(", ") : provinceValue;
  
  // Для текстовых критериев используем "неподходящего", для числовых — "неподходящей"
  const adjective = checkField.evaluator === evaluateTextCriteria ? "➤ Неподходящего критерия" : "➤ Неподходящего уровня";
  
  return `${adjective} ${detail.emoji} ${detail.label} ( требуется: ${requiredText}, обнаружено: ${provinceText} )\n`;
}

/**
 * Массив объектов для проверки дополнительных условий
 */
const CHECK_FIELDS = [
  {
    buildingKey: 'required_landscapes', // Ключ из шаблона постройки
    provinceKey: 'landscapes',           // Соответствующий ключ из провинции
    evaluator: evaluateTextCriteria      
  },
  {
    buildingKey: 'required_planet',     
    provinceKey: 'planet',               
    evaluator: evaluateTextCriteria  
  },
  {
    buildingKey: 'required_culture',     
    provinceKey: 'province_culture',               
    evaluator: evaluateTextCriteria  
  },
  {
    buildingKey: 'required_religion',     
    provinceKey: 'province_religion',               
    evaluator: evaluateTextCriteria  
  },
  {
    buildingKey: 'required_climate',     
    provinceKey: 'province_climate',               
    evaluator: evaluateTextCriteria  
  },
  {
    buildingKey: 'required_radiation',
    provinceKey: 'province_radiation',
    evaluator: evaluateNumberCriteria
  },
  {
    buildingKey: 'required_pollution',
    provinceKey: 'province_pollution',
    evaluator: evaluateNumberCriteria
  },
  {
    buildingKey: 'required_stability',
    provinceKey: 'province_stability',
    evaluator: evaluateNumberCriteria
  }
  // Добавляйте новые условия по мере необходимости
];

/**
 * Массив ключей провинции, использующих evaluateTextCriteria
 */
const TEXT_CRITERIA_KEYS = CHECK_FIELDS
  .filter(field => field.evaluator === evaluateTextCriteria)
  .map(field => field.provinceKey);

/**
 * Функция для парсинга и обработки JSON данных согласно заданию
 * @param {Object} data - Объект с данными из именованных диапазонов
 * @param {Sheet} sheet - Активный лист
 * @param {Spreadsheet} spreadsheet - Активная таблица
 * @returns {Object} - Объект с обновленными данными и новыми сообщениями
 */
function processBuildingsCriterias(data, sheet, spreadsheet) {
  const variablesData = data['Переменные'];
  const templatesData = data['Постройки_Шаблоны'];
  const provinceData = data['Провинции_ОсновнаяИнформация'];
  
  let newMessages = []; // Массив для хранения новых сообщений
  
  // Проверяем наличие данных в Переменные
  if (!variablesData || variablesData.length === 0 || !variablesData[0][0]) {
    const errorMsg = 'Переменные пуст или не содержит данных.';
    newMessages.push(`[Ошибка][processBuildingsCriterias] ${errorMsg}`);
    return newMessages; // Возвращаем без изменений
  }
  
  // Парсим JSON из Переменные и получаем state_name
  let stateName;
  try {
    const targetIdentifier = 'Основные данные государства';
    
    // Ищем строку с нужным идентификатором
    const targetRow = variablesData.find(row => row[0] === targetIdentifier);
    
    if (targetRow && targetRow[1]) {
      // Извлекаем JSON из второго столбца
      const jsonMatch = targetRow[1].match(/\{.*\}/);
      if (jsonMatch) {
        const range1Json = JSON.parse(jsonMatch[0]);
        stateName = range1Json.state_name;
        
        if (!stateName) {
          const errorMsg = 'Ключ "state_name" не найден в Переменные.';
          newMessages.push(`[Ошибка][processBuildingsCriterias] ${errorMsg}`);
          return newMessages;
        }
      } else {
        throw new Error('Не удалось извлечь JSON из содержимого Переменные.');
      }
    } else {
      throw new Error(`Идентификатор "${targetIdentifier}" не найден в Переменные.`);
    }
  } catch (e) {
    const errorMsg = `Ошибка при парсинге JSON из Переменные: ${e.message}`;
    newMessages.push(`[Ошибка][processBuildingsCriterias] ${errorMsg}`);
    return newMessages;
  }
  
  // Парсим все JSON из Постройки_Шаблоны (шаблоны) без фильтрации по owner
  const templates = [];
  for (let i = 0; i < templatesData.length; i++) {
    const cell = templatesData[i][0];
    if (cell) {
      try {
        const template = JSON.parse(cell);
        templates.push({ 
          data: template, 
          row: i 
        });
      } catch (e) {
        const errorMsg = `Ошибка при парсинге JSON из Постройки_Шаблоны, строка ${i+1}: ${e.message}`;
        newMessages.push(`[Ошибка][processBuildingsCriterias] ${errorMsg}`);
        // Игнорируем ошибку и продолжаем
      }
    }
  }
  
  if (templates.length === 0) {
    const errorMsg = 'Нет корректных шаблонов в Постройки_Шаблоны для обработки.';
    newMessages.push(`[Ошибка][processBuildingsCriterias] ${errorMsg}`);
    return newMessages;
  }
  
  // Парсим все JSON из Провинции_ОсновнаяИнформация и создаем карту id -> province
  const provinceMap = {};
  const allProvinces = [];
  for (let i = 0; i < provinceData.length; i++) {
    const cell = provinceData[i][0];
    if (cell) {
      try {
        let jsonString = cell;
        
        // Удаляем внешние кавычки, если они есть
        if (jsonString.startsWith('"') && jsonString.endsWith('"')) {
          jsonString = jsonString.slice(1, -1);
        }   
        
        const province = JSON.parse(jsonString);
        if (province.id) {
          // Автоматическое преобразование полей, использующих evaluateTextCriteria
          TEXT_CRITERIA_KEYS.forEach(key => {
            if (province[key]) {
              if (typeof province[key] === 'string') {
                province[key] = province[key].split(',').map(item => item.trim());
              }
              // Если поле уже массив, ничего не делаем
            }
          });
          
          // Преобразуем available_resources в массив, если это строка
          if (province.available_resources && typeof province.available_resources === 'string') {
            province.available_resources = province.available_resources.split(',').map(item => item.trim());
          }
          
          provinceMap[province.id] = province;
          allProvinces.push(province);
        }
      } catch (e) {
        const errorMsg = `Ошибка при парсинге JSON из Провинции_ОсновнаяИнформация, строка ${i+1}: ${e.message}`;
        newMessages.push(`[Ошибка][processBuildingsCriterias] ${errorMsg}`);
        // Игнорируем ошибку и продолжаем
      }
    }
  }
  
  // Обрабатываем каждый шаблон
  templates.forEach(templateInfo => {
    const template = templateInfo.data;
    
    // Инициализируем массивы для соответствующих провинций
    const matchingProvincesState = [];
    const matchingProvincesOthers = [];
    const nonMatchingProvincesDetails = [];
    
    // Проходим по каждой провинции и проверяем условия с подробным сбором причин
    allProvinces.forEach(province => {
      let allConditionsMet = true;
      let failureReasons = [];
      
      CHECK_FIELDS.forEach(checkField => {
        const buildingCondition = template[checkField.buildingKey];
        const provinceValue = province[checkField.provinceKey];
        
        if (buildingCondition !== undefined && buildingCondition !== null) {
          const result = checkField.evaluator(buildingCondition, provinceValue);
          
          if (!result) {
            allConditionsMet = false;
            // Генерируем подробное сообщение по критерию
            const reasonMsg = generateDetailedReason(checkField, buildingCondition, provinceValue);
            failureReasons.push(reasonMsg);
          }
        }
      });
      
      if (allConditionsMet) {
        if (province.owner === stateName) {
          matchingProvincesState.push(province.id);
        } else {
          matchingProvincesOthers.push(province.id);
        }
      } else {
        nonMatchingProvincesDetails.push({ province, failureReasons });
      }
    });
    
    // Добавляем результаты в шаблон
    template.matching_provinces_state = matchingProvincesState;
    template.matching_provinces_others = matchingProvincesOthers;
    template.allowed_building_state = matchingProvincesState;
    template.allowed_building_others = matchingProvincesOthers;
    
    const constructionName = template.name ? `${template.name}` : `"Неизвестно"`;
    const constructionOwner = template.owner ? `${template.owner}` : `"Неизвестно"`;
    
    if (matchingProvincesState.length > 0 || matchingProvincesOthers.length > 0) {
      // Если есть подходящие провинции, генерируем сообщение о возможностях
      newMessages.push(`[Основные критерии построек] \n🏗️ Постройка 🏭 ${constructionName} подходит для провинций:\n`);
      
      if (matchingProvincesState.length > 0) {
        const provincesStateList = matchingProvincesState.join(', ');
        newMessages.push(`[Основные критерии построек] \n✅ Нашего государства: ${provincesStateList}.\n`);
      }
      
      if (matchingProvincesOthers.length > 0) {
        const provincesOthersList = matchingProvincesOthers.join(', ');
        newMessages.push(`[Основные критерии построек] \n✅ Других государств: ${provincesOthersList}.\n`);
      }
    }
    
    // Если ни одна провинция не подходит, генерируем подробные сообщения для каждой провинции
    if (matchingProvincesState.length === 0 && matchingProvincesOthers.length === 0) {
      nonMatchingProvincesDetails.forEach(detail => {
        const province = detail.province;
        // Используем province.name, если есть, иначе id
        const provinceIdentifier = province.name ? province.name : province.id;
        const reasonsText = detail.failureReasons.join("");
        newMessages.push(`[Основные критерии построек] \nПровинция 📌 ${provinceIdentifier} не подходит для постройки 🏭 ${constructionName} из-за: \n ${reasonsText}`);
      });
    }
    
    // Сериализуем обновленный шаблон обратно в JSON
    data['Постройки_Шаблоны'][templateInfo.row][0] = JSON.stringify(template);
  });
  
  return newMessages;
}

/**
 * Универсальная функция для оценки логических условий относительно массива значений провинции
 * Поддерживаются операторы AND, OR, NOT, XOR, NAND, NOR
 * @param {Object} required - Объект с логическими операторами
 * @param {Array} provinceValues - Массив значений провинции (например, landscapes, planet и т.д.)
 * @returns {boolean} - Результат оценки выражения
 */
function evaluateTextCriteria(required, provinceValues) {
  if (!required || typeof required !== 'object') {
    return false;
  }
  
  // Если объект пустой, возвращаем true (отсутствие ограничений)
  if (Object.keys(required).length === 0) {
    return true;
  }
  
  // Проверяем, что provinceValues является массивом
  if (!Array.isArray(provinceValues)) {
    return false;
  }
  
  // Приводим все элементы provinceValues к верхнему регистру и обрезаем пробелы
  const normalizedValues = provinceValues.map(v => v.trim().toUpperCase());
  
  // Предполагаем, что required содержит только один оператор на уровне объекта
  const operators = Object.keys(required);
  if (operators.length !== 1) {
    return false;
  }
  
  const operator = operators[0].toUpperCase();
  const operands = required[operators[0]];
  
  switch (operator) {
    case 'AND':
      // Все операнды должны быть истинными
      return operands.every(item => {
        if (typeof item === 'string') {
          return normalizedValues.includes(item.toUpperCase());
        } else if (typeof item === 'object') {
          return evaluateTextCriteria(item, provinceValues);
        }
        return false;
      });
      
    case 'OR':
      // Хотя бы один операнд должен быть истинным
      return operands.some(item => {
        if (typeof item === 'string') {
          return normalizedValues.includes(item.toUpperCase());
        } else if (typeof item === 'object') {
          return evaluateTextCriteria(item, provinceValues);
        }
        return false;
      });
      
    case 'NOT':
      // Один операнд, должен быть ложным
      if (!Array.isArray(operands) || operands.length !== 1) {
        return false;
      }
      const operandNot = operands[0];
      if (typeof operandNot === 'string') {
        return !normalizedValues.includes(operandNot.toUpperCase());
      } else if (typeof operandNot === 'object') {
        return !evaluateTextCriteria(operandNot, provinceValues);
      }
      return false;
      
    case 'XOR':
      // Требуется, чтобы ровно один операнд был истинным
      let trueCount = 0;
      operands.forEach(item => {
        if (typeof item === 'string') {
          if (normalizedValues.includes(item.toUpperCase())) {
            trueCount += 1;
          }
        } else if (typeof item === 'object') {
          if (evaluateTextCriteria(item, provinceValues)) {
            trueCount += 1;
          }
        }
      });
      return (trueCount === 1);
      
    case 'NAND':
      // NAND = NOT (AND)
      const andResult = operands.every(item => {
        if (typeof item === 'string') {
          return normalizedValues.includes(item.toUpperCase());
        } else if (typeof item === 'object') {
          return evaluateTextCriteria(item, provinceValues);
        }
        return false;
      });
      return !andResult;
      
    case 'NOR':
      // NOR = NOT (OR)
      const orResult = operands.some(item => {
        if (typeof item === 'string') {
          return normalizedValues.includes(item.toUpperCase());
        } else if (typeof item === 'object') {
          return evaluateTextCriteria(item, provinceValues);
        }
        return false;
      });
      return !orResult;
      
    default:
      return false;
  }
}

/**
 * Универсальная функция для оценки числовых условий
 * Поддерживаются операторы GREATER_THAN, LESS_THAN, EQUAL_TO, GREATER_OR_EQUAL_TO, LESS_OR_EQUAL_TO, BETWEEN
 * @param {Object} required - Объект с оператором и операндом(ами)
 * @param {number} current - Текущее значение поля провинции
 * @param {string} fieldName - Название поля для логирования
 * @returns {boolean} - Результат оценки условия
 */
function evaluateNumberCriteria(required, current, fieldName) {
  if (!required || typeof required !== 'object') {
    return false;
  }
  
  // Если объект пустой, возвращаем true (отсутствие ограничений)
  if (Object.keys(required).length === 0) {
    return true;
  }
  
  const operators = Object.keys(required);
  if (operators.length !== 1) {
    return false;
  }
  
  const operator = operators[0].toUpperCase();
  const operand = required[operators[0]];
  
  switch (operator) {
    case 'GREATER_THAN':
      return current > operand;
    case 'LESS_THAN':
      return current < operand;
    case 'EQUAL_TO':
      return current === operand;
    case 'GREATER_OR_EQUAL_TO':
      return current >= operand;
    case 'LESS_OR_EQUAL_TO':
      return current <= operand;
    case 'BETWEEN':
      if (Array.isArray(operand) && operand.length === 2) {
        const [min, max] = operand;
        return current >= min && current <= max;
      } else {
        return false;
      }
    // Добавьте дополнительные операторы по необходимости
    default:
      return false;
  }
}