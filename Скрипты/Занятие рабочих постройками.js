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
      console.log(errMsg);
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
            console.log(errMsg);
            return messages;
          }
        } else {
          throw new Error('Не удалось извлечь JSON из "Переменные".');
        }
      } else {
        throw new Error('Идентификатор "Основные данные государства" не найден.');
      }
      console.log(`🌐 Название государства: ${stateName}`);
    } catch (e) {
      const errMsg = `[❌ Ошибка] Ошибка при извлечении state_name: ${e.message}`;
      messages.push(errMsg);
      console.log(errMsg);
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
        console.log(errMsg);
        return;
      }

      // Обработка каждого здания из ячейки
      buildingEntries.forEach((building, index) => {
        console.log(`🏗️ Обработка здания в строке ${rowIndex + 1}, элемент ${index + 1}: ${building.building_name}`);
        try {
          if (building.building_owner !== stateName || building.status !== "Активная") {
            console.log(`⏭️ Пропуск здания "${building.building_name}": неактивное или принадлежит другому государству.`);
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
            console.log(errMsg);
            return;
          }

          const templateObj = JSON.parse(template[0]);
          const requiredWorkers = templateObj.required_workers || 0;
          const requiredProfessions = templateObj.required_workers_professions || [];
          console.log(`👷 Требуется рабочих: ${requiredWorkers} для постройки "${building.building_name}"`);

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
            console.log(errMsg);
            return;
          }

          const provincePopObj = JSON.parse(provinceData[0]);
          const availableWorkers = provincePopObj.unemployed_workers || 0;
          console.log(`🛠️ В провинции "${building.province_id}" доступно рабочих: ${availableWorkers}`);

          if (availableWorkers < requiredWorkers) {
            // Обновляем статус здания в объекте
            building.status = "Неактивная";
            const alertMsg = `[⚠️ Оповещение] Постройка "${building.building_name}" в провинции "${building.province_id}" деактивирована из-за нехватки рабочих.`;
            messages.push(alertMsg);
            console.log(alertMsg);
            return;
          }

          // Обновляем данные о рабочей силе
          provincePopObj.unemployed_workers -= requiredWorkers;
          provincePopObj.employed_workers += requiredWorkers;
          console.log(`🔄 Обновлённые данные: безработных - ${provincePopObj.unemployed_workers}, занятых - ${provincePopObj.employed_workers}`);

          // Обновляем профессии
          const professionsMap = provincePopObj.professions[0] || {};
          requiredProfessions.forEach(prof => {
            professionsMap[prof.profession] = (professionsMap[prof.profession] || 0) + prof.quantity;
            console.log(`💼 Добавлено ${prof.quantity} работников профессии "${prof.profession}"`);
          });

          provincePopObj.professions[0] = professionsMap;
          populationData[populationData.indexOf(provinceData)][0] = JSON.stringify(provincePopObj);

          const successMsg = `[✅ Успешно] Постройка "${building.building_name}" в провинции "${building.province_id}" получила ${requiredWorkers} рабочих.`;
          messages.push(successMsg);
          console.log(successMsg);
        } catch (e) {
          const errMsg = `[❌ Ошибка] Ошибка обработки здания в строке ${rowIndex + 1}, элемент ${index + 1}: ${e.message}`;
          messages.push(errMsg);
          console.log(errMsg);
        }
      });
      // После обработки всех зданий в ячейке, сохраняем обновлённые данные
      row[0] = JSON.stringify(buildingEntries);
      console.log(`💾 Обновлены данные строки ${rowIndex + 1}.`);
    });

    console.log('📝 Итоговые сообщения:', messages);
    return messages;
  } catch (error) {
    const errMsg = `[❌ Ошибка] Ошибка выполнения processRequiredWorkers: ${error.message}`;
    messages.push(errMsg);
    console.log(errMsg);
    return messages;
  }
}
