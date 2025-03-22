/**
 * Функция для обработки требований к пахотным землям в шаблонах построек
 * @param {Object} data - Объект с данными из именованных диапазонов
 * @param {Sheet} sheet - Активный лист (не используется, но включен для совместимости)
 * @param {Spreadsheet} spreadsheet - Активная таблица (может быть использована для логирования)
 * @returns {Array<string>} messages - Массив сообщений об обработке
 */
function processArableLandRequirements(data, sheet, spreadsheet) {
  const messages = [];
  
  try {
    const templatesData = data['Постройки_Шаблоны'];
    const provincesData = data['Провинции_ОсновнаяИнформация'];

    if (!templatesData || templatesData.length === 0) {
      messages.push('[Ошибка][processArableLandRequirements] Именной диапазон "Постройки_Шаблоны" пуст или не содержит данных.');
      return messages;
    }

    if (!provincesData || provincesData.length === 0) {
      messages.push('[Ошибка][processArableLandRequirements] Именной диапазон "Провинции_ОсновнаяИнформация" пуст или не содержит данных.');
      return messages;
    }

    // Парсинг провинций для быстрого доступа
    const provinces = provincesData
      .map((row, index) => {
        const cell = row[0];
        if (cell) {
          try {
            const province = JSON.parse(cell);
            if (province.id && typeof province.free_arable_land === 'number') {
              // Предполагается, что в объекте провинции присутствуют поля total_arable_land и occupied_arable_land.
              // Если их нет, их можно установить равными, например, total_arable_land = free_arable_land + occupied_arable_land.
              if (typeof province.total_arable_land !== 'number' || typeof province.occupied_arable_land !== 'number') {
                messages.push(`[Ошибка][processArableLandRequirements] Провинция в строке ${index + 1} не содержит корректных данных для "total_arable_land" или "occupied_arable_land".`);
                return null;
              }
              return province;
            } else {
              messages.push(`[Ошибка][processArableLandRequirements] Провинция в строке ${index + 1} не содержит ключи "id" или "free_arable_land" с корректными типами.`);
              return null;
            }
          } catch (e) {
            messages.push(`[Ошибка][processArableLandRequirements] Парсинг JSON провинции в строке ${index + 1}: ${e.message}`);
            return null;
          }
        }
        return null;
      })
      .filter(province => province !== null);

    // Создание карты провинций по ID для быстрого доступа
    const provinceMap = {};
    provinces.forEach(province => {
      provinceMap[province.id] = province;
    });

    // Функция для фильтрации списка провинций с расширенным выводом сообщения
const filterProvinces = (provinceList, type, templateName, requiredArableLand) => {
  if (Array.isArray(provinceList)) {
    const filtered = [];
    provinceList.forEach(id => {
      if (provinceMap[id] && provinceMap[id].free_arable_land >= requiredArableLand) {
        filtered.push(id);
      } else {
        const prov = provinceMap[id];
        if (prov) {
          // Определяем, какое слово использовать в зависимости от типа
          const provinceDescriptor = type === 'наши провинции' ? 'наша' : 'чужая';
          messages.push(`[Постройки][Доступность аграрных земель] Для постройки 🏭 ${templateName} ${provinceDescriptor} провинция 📌 ${prov.id} не подходит:\n ➤ Требуется 🌾 ${requiredArableLand} пахотных земель \n ➤ Всего 🌾󠁧󠁢󠁳 ${prov.total_arable_land} \n ➤ Занято 🌾 ${prov.occupied_arable_land} \n ➤ Свободно 🌾 ${prov.free_arable_land}. \n`);
        } else {
          messages.push(`[Постройки][Доступность аграрных земель] Для постройки "${templateName}" провинция "${id}" отсутствует в данных провинций.`);
        }
      }
    });
    return filtered;
  }
  messages.push(`[Ошибка][processArableLandRequirements] В шаблоне "${templateName}" ключ "${type}" не является массивом.`);
  return [];
};


    // Обработка каждого шаблона построек
    const updatedTemplates = templatesData.map((row, rowIndex) => {
      const cell = row[0];
      if (cell) {
        try {
          const template = JSON.parse(cell);

          // Добавление ключа "required_arable_land", если его нет
          if (!template.hasOwnProperty('required_arable_land')) {
            template.required_arable_land = 0;
            messages.push(`[Информация] В шаблон "${template.name}" добавлен ключ "required_arable_land" со значением 0.`);
          }

          let requiredArableLand = template.required_arable_land;

          if (typeof requiredArableLand !== 'number' || requiredArableLand < 0) {
            messages.push(`[Ошибка][processArableLandRequirements] В шаблоне "${template.name}" значение "required_arable_land" некорректно: ${requiredArableLand}. Установлено значение 0.`);
            template.required_arable_land = 0;
            requiredArableLand = 0;
          }

          // Фильтрация провинций, соответствующих требованию
          const eligibleProvinces = provinces
            .filter(province => province.free_arable_land >= requiredArableLand)
            .map(province => province.id);

          // Обновление списков allowed_building_state и allowed_building_others с расширенной информацией
          if (template.hasOwnProperty('allowed_building_state')) {
            template.allowed_building_state = filterProvinces(template.allowed_building_state, 'наши провинции', template.name, requiredArableLand);
          } else {
            messages.push(`[Ошибка][processArableLandRequirements] В шаблоне "${template.name}" отсутствует ключ "allowed_building_state".`);
          }

          if (template.hasOwnProperty('allowed_building_others')) {
            template.allowed_building_others = filterProvinces(template.allowed_building_others, 'провинции других государств', template.name, requiredArableLand);
          } else {
            messages.push(`[Ошибка][processArableLandRequirements] В шаблоне "${template.name}" отсутствует ключ "allowed_building_others".`);
          }

          // Возврат обновленного шаблона
          return [JSON.stringify(template)];
        } catch (e) {
          messages.push(`[Ошибка][processArableLandRequirements] Парсинг JSON шаблона в строке ${rowIndex + 1}: ${e.message}`);
          return row; // Возврат исходной строки без изменений
        }
      }
      return row; // Пустые ячейки остаются без изменений
    });

    // Обновление данных в объекте data
    data['Постройки_Шаблоны'] = updatedTemplates;

    return messages;
    
  } catch (error) {
    messages.push(`[Ошибка][processArableLandRequirements] processArableLandRequirements: ${error.message}`);
    return messages;
  }
}
