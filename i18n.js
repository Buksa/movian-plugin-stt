'use strict';
// Movian has no translation API for plugin JS (GLW's _() only reads the core's own catalog).
// As in Movian's .lang files, the English text is the key; Russian comes from the table below.
var prop = require('movian/prop');

var ru = {
    'Live streams': 'Прямые эфиры',
    'Twitch categories': 'Категории Twitch',
    'Twitch account': 'Аккаунт Twitch',
    'Favorite channels': 'Избранные каналы',
    'Streams': 'Трансляции',
    'Videos': 'Записи',
    'Clips': 'Клипы',
    'Twitch search: %s': 'Поиск Twitch: %s',
    'Channel, category or Twitch link': 'Канал, категория или ссылка Twitch',
    'Nothing found.': 'Ничего не найдено.',
    'Nothing here yet.': 'В этом разделе пока ничего нет.',
    'Log in to Twitch for more pages.': 'Для следующих страниц войдите в Twitch.',
    'Twitch session ended. Log in again.': 'Сеанс Twitch завершён. Войдите заново.',
    'Log in again to show your Twitch follows.': 'Войдите заново, чтобы показать подписки Twitch.',
    'Add a channel to favorites on its page.': 'Добавьте канал в избранное на его странице.',
    'Channel added to favorites': 'Канал добавлен в избранное',
    'Channel removed from favorites': 'Канал удалён из избранного',
    'Add to favorites': 'Добавить в избранное',
    'Remove from favorites': 'Убрать из избранного',
    'Live': 'В эфире',
    'Offline': 'Сейчас не в эфире',
    'Channel: %s': 'Канал: %s',
    'Category: %s': 'Категория: %s',
    'Open the stream on the channel page.': 'Откройте трансляцию на странице канала.',
    'Source · %s': 'Источник · %s',
    'Twitch video': 'Запись Twitch',
    'Twitch clip': 'Клип Twitch',
    'Logged in as %s': 'Вы вошли как %s',
    'Logged in as %s. Open “Categories”.': 'Вы вошли как %s. Откройте «Категории».',
    'Log in to open the full category catalog.': 'Войдите, чтобы открыть полный каталог категорий.',
    'Code login cancelled.': 'Вход по коду отменён.',
    'Log in with a code': 'Войти по коду',
    'Requesting a code from Twitch…': 'Запрашиваем код у Twitch…',
    'On your phone open twitch.tv/activate?public=true and enter the code.':
        'На телефоне откройте twitch.tv/activate?public=true и введите код.',
    'The code expired. Request a new one.': 'Код истёк. Запросите новый.',
    'Login denied.': 'Вход отклонён.',
    'Set Public Client ID': 'Настроить Public Client ID',
    'Public Client ID (leave empty for the built-in one)': 'Public Client ID (пустое поле — использовать встроенный)',
    'Enter a Public Client ID, not a secret.': 'Укажите Public Client ID, не секрет.',
    'Choose “Log in with a code”.': 'Выберите «Войти по коду».',
    'Log out / cancel login': 'Выйти / отменить вход',
    'Twitch account disconnected.': 'Аккаунт Twitch отключён.',
    'Twitch gave no code. Check that the Client ID belongs to a Public app.':
        'Twitch не выдал код. Проверьте, что Client ID принадлежит приложению типа Public.',
    'Twitch rejected the login code (HTTP %s). Request a new code.':
        'Twitch отклонил код входа (HTTP %s). Запросите новый код.',
    'Could not check the Twitch session (HTTP %s).': 'Не удалось проверить сеанс Twitch (HTTP %s).',
    'Twitch returned an incomplete token.': 'Twitch вернул неполный токен.',
    'Twitch did not confirm the user token.': 'Twitch не подтвердил токен пользователя.',
    'Could not renew the Twitch login (HTTP %s).': 'Не удалось обновить вход Twitch (HTTP %s).',
    'Twitch login check is already running. Open the catalog again.':
        'Проверка входа Twitch уже идёт. Откройте каталог ещё раз.',
    'Could not load the Helix catalog (HTTP %s).': 'Не удалось загрузить каталог Helix (HTTP %s).',
    'Invalid Twitch stream address.': 'Неверный адрес эфира Twitch.',
    'Invalid Twitch stream CDN.': 'Неверный CDN эфира Twitch.',
    'Twitch playlist unavailable (HTTP %s).': 'Плейлист Twitch недоступен (HTTP %s).',
    'Twitch offered no compatible H.264 variant.': 'Twitch не предоставил совместимый вариант H.264.',
    'Could not connect to Twitch: %s': 'Не удалось подключиться к Twitch: %s',
    'Twitch returned HTTP %s': 'Twitch вернул HTTP %s',
    'Twitch API error': 'Ошибка API Twitch',
    'Unknown Twitch section.': 'Неизвестный раздел Twitch.',
    'Channel or category not found.': 'Канал или категория не найдены.',
    'Twitch channel not found.': 'Канал Twitch не найден.',
    'Twitch category not found.': 'Категория Twitch не найдена.',
    'Twitch did not allow playback.': 'Twitch не выдал разрешение на просмотр.',
    'The channel is offline.': 'Канал сейчас не в эфире.',
    'The Twitch video was deleted or is unavailable.': 'Запись Twitch удалена или недоступна.',
    'The Twitch clip was deleted or is unavailable.': 'Клип Twitch удалён или недоступен.',
    'The clip cannot be played.': 'Клип недоступен для просмотра.'
};

function language() {
    // Read on every call: the user can switch language while the plugin runs, and it is unset at plugin start.
    try { return String(prop.global.i18n.iso639_1); } catch (e) { return ''; }
}

exports.t = function(text, arg) {
    var out = language() === 'ru' && ru[text] || text;
    // A function keeps $&, $' and similar in arg literal (search queries, Twitch error text).
    return arg === undefined ? out : out.replace('%s', function() { return arg; });
};
exports.ru = ru;
