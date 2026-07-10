/**
 * HookahCRM — приём онбординг-брифов в Google Sheets.
 *
 * Установка:
 *  1) Создайте Google-таблицу (sheets.new).
 *  2) Расширения → Apps Script. Удалите шаблон, вставьте весь этот код, Сохранить.
 *  3) Развернуть → Новое развёртывание → шестерёнка → «Веб-приложение».
 *     Выполнять как: «Я». Доступ: «Все» (или «Все, у кого есть ссылка»).
 *     Развернуть → скопируйте URL веб-приложения (заканчивается на /exec).
 *  4) Пришлите этот URL — впишу его в бриф (SHEET_URL) и передеплою.
 *
 * Каждая заявка добавляется строкой; ключи брифа становятся колонками
 * автоматически (новые ключи — новые колонки).
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var payload = data.payload || {};
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

    var flat = {
      'Заведение': data.venue || '',
      'Город': data.city || '',
      'Контакт': data.contact || '',
      'Телефон': data.phone || ''
    };
    Object.keys(payload).forEach(function (k) { flat[k] = flatten(payload[k]); });

    var base = ['Дата', 'Заведение', 'Город', 'Контакт', 'Телефон'];
    var header = sheet.getLastRow() > 0
      ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      : [];

    if (header.length === 0) {
      header = base.slice();
      Object.keys(flat).forEach(function (k) { if (header.indexOf(k) < 0) header.push(k); });
      sheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
    } else {
      Object.keys(flat).forEach(function (k) {
        if (header.indexOf(k) < 0) { header.push(k); sheet.getRange(1, header.length).setValue(k).setFontWeight('bold'); }
      });
    }

    var row = header.map(function (col) {
      if (col === 'Дата') return new Date();
      return flat[col] !== undefined ? flat[col] : '';
    });
    sheet.appendRow(row);

    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function flatten(v) {
  if (Array.isArray(v)) {
    if (v.length && typeof v[0] === 'object') {
      return v.map(function (o) {
        return Object.keys(o).map(function (k) { return k + ': ' + o[k]; }).join(' · ');
      }).join('\n');
    }
    return v.join(', ');
  }
  return v == null ? '' : String(v);
}
