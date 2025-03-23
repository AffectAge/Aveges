function processEmployment(data, sheet, spreadsheet) {
  const messages = [];

  try {
    const templatesData = data['Постройки_Шаблоны'];
    const populationData = data['Население_ОсновнаяИнформация'];
    const buildingsData = data['Постройки_ОсновнаяИнформация'];
    const variablesData = data['Переменные'];

    if (!templatesData || !populationData || !buildingsData || !variablesData) {
      const errMsg = '[❌ Ошибка] Один из именованных диапазонов отсутствует или пуст.';
      messages.push(errMsg);
      return messages;
    }

    // Получаем название государства
    let stateName;
    try {
      const targetRow = variablesData.find(row => row[0] === 'Основные данные государства');
      if (targetRow && targetRow[1]) {
        const jsonMatch = targetRow[1].match(/\{.*\}/);
        if (jsonMatch) {
          const variablesJson = JSON.parse(jsonMatch[0]);
          stateName = variablesJson.state_name;
          if (!stateName) {
            const errMsg = '[❌ Ошибка] Ключ "state_name" отсутствует в "Переменные".';
            messages.push(errMsg);
            return messages;
          }
        } else {
          throw new Error('Не удалось извлечь JSON из "Переменные".');
        }
      } else {
        throw new Error('Идентификатор "Основные данные государства" не найден.');
      }
    } catch (e) {
      const errMsg = `[❌ Ошибка] Ошибка при извлечении state_name: ${e.message}`;
      messages.push(errMsg);
      return messages;
    }

    // Обрабатываем каждую строку с постройками
    buildingsData.forEach((row, rowIndex) => {
      const cell = row[0];
      if (!cell) return;

      let buildingEntries;
      try {
        // Пытаемся распарсить содержимое ячейки как JSON
        const parsed = JSON.parse(cell);
        // Если это массив – работаем с каждым элементом,
        // иначе оборачиваем один объект в массив
        buildingEntries = Array.isArray(parsed) ? parsed : [parsed];
      } catch (e) {
        const errMsg = `[❌ Ошибка] Невозможно распарсить данные о постройках в строке ${rowIndex + 1}: ${e.message}`;
        messages.push(errMsg);
        return;
      }

      // Обработка каждого здания из ячейки
      buildingEntries.forEach((building, index) => {
        try {
          if (building.building_owner !== stateName || building.status !== "Активная") {
            return; // Пропускаем неактивные или чужие здания
          }

          // Ищем шаблон постройки
          const template = templatesData.find(tRow => {
            const templateCell = tRow[0];
            if (!templateCell) return false;
            try {
              const templateObj = JSON.parse(templateCell);
              return templateObj.name === building.building_name;
            } catch {
              return false;
            }
          });

          if (!template) {
            const errMsg = `[❌ Ошибка] Шаблон для постройки "${building.building_name}" не найден.`;
            messages.push(errMsg);
            return;
          }

          const templateObj = JSON.parse(template[0]);
          const requiredWorkers = templateObj.required_workers || 0;
          const requiredProfessions = templateObj.required_workers_professions || [];

          // Получаем данные о населении провинции
          const provinceData = populationData.find(pRow => {
            const popCell = pRow[0];
            if (!popCell) return false;
            try {
              const popObj = JSON.parse(popCell);
              return popObj.province_id === building.province_id;
            } catch {
              return false;
            }
          });

          if (!provinceData) {
            const errMsg = `[❌ Ошибка] Данные о населении для провинции "${building.province_id}" не найдены.`;
            messages.push(errMsg);
            return;
          }
		  
          const provincePopObj = JSON.parse(provinceData[0]);
          const availableWorkers = provincePopObj.unemployed_workers || 0;
		  const totalWorkers = (provincePopObj.unemployed_workers || 0) + (provincePopObj.employed_workers || 0);
		  
		  // Если ключа professions нет или он не является массивом, создаём его
          if (!provincePopObj.professions || !Array.isArray(provincePopObj.professions)) {
            provincePopObj.professions = [{}];
          }

          if (availableWorkers < requiredWorkers) {
            // Обновляем статус здания в объекте
            building.status = "Неактивная";
            const alertMsg = `[Найм рабочих] ❌ Постройка 🏭 ${building.building_name} в провинции 📌 ${building.province_id} не будет работать из-за нехватки рабочих.\n ➤ Требуется: 👷🏼 ${requiredWorkers}\n ➤ Свободных: 👷🏼 ${provincePopObj.unemployed_workers || 0}\n ➤ Занятых: 👷🏼 ${provincePopObj.employed_workers || 0}\n ➤ Всего в провинции: 👷🏼 ${totalWorkers}. \n`;
            messages.push(alertMsg);
            return;
          }

          // Обновляем данные о рабочей силе
          provincePopObj.unemployed_workers -= requiredWorkers;
          provincePopObj.employed_workers += requiredWorkers;

          // Обновляем профессии
          // Обновляем профессии
const professionsMap = provincePopObj.professions[0] || {};
let professionsSummary = '';
requiredProfessions.forEach(prof => {
  professionsMap[prof.profession] = (professionsMap[prof.profession] || 0) + prof.quantity;
  professionsSummary += `   💼 ${prof.profession}: + 👷🏼 ${prof.quantity} \n`;
});
provincePopObj.professions[0] = professionsMap;

          provincePopObj.professions[0] = professionsMap;
          populationData[populationData.indexOf(provinceData)][0] = JSON.stringify(provincePopObj);
          
          const successMsg = `[Найм рабочих] ✅ Постройка 🏭 ${building.building_name} в провинции 📌 ${building.province_id} наняла 👷🏼 ${requiredWorkers} рабочих. \n ➤ Свободных: 👷🏼 ${provincePopObj.unemployed_workers || 0}\n ➤ Занятых: 👷🏼 ${provincePopObj.employed_workers || 0}\n ➤ Всего в провинции: 👷🏼 ${totalWorkers}. \n ➤ Нанятые рабочие по профессиям:\n ${professionsSummary}`;
          messages.push(successMsg);
        } catch (e) {
          const errMsg = `[❌ Ошибка] Ошибка обработки здания в строке ${rowIndex + 1}, элемент ${index + 1}: ${e.message}`;
          messages.push(errMsg);
        }
      });
      // После обработки всех зданий в ячейке, сохраняем обновлённые данные
      row[0] = JSON.stringify(buildingEntries);
    });

    return messages;
  } catch (error) {
    const errMsg = `[❌ Ошибка] Ошибка выполнения processRequiredWorkers: ${error.message}`;
    messages.push(errMsg);
    return messages;
  }
}
