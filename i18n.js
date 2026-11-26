'use strict';
// Translations live in lang/<iso639_1>.lang, in Movian's .lang format: "id:" is the English text
// the plugin shows, "msg:" its translation. English needs no file; a missing file or entry shows English.
// Movian has no translation API for plugin JS, and GLW's _() only reads the core catalog.
var prop = require('movian/prop');
var fs = require('fs');
var tables = Object.create(null);

// Text the views show. Views read it from page metadata (see viewText), keyed by these ids.
var viewKeys = {
    menuHint: '← Menu   ·   OK Open', loading: 'Loading Twitch…', closeMenu: '→ Close menu',
    navAccount: 'Twitch account', navSearch: 'Search', navFavorites: 'Favorites', navStreams: 'Live streams',
    navGames: 'Categories', navVideos: 'Videos', navClips: 'Clips',
    openChannel: 'Open channel', openCategory: 'Open category',
    channels: 'Channels:', viewersLabel: 'Viewers:', views: 'views', viewers: 'viewers',
    quality: 'Quality:', videoQuality: 'Video quality', backToPlayer: '← Back to player'
};

function language() {
    // Read on every call: unset when the plugin starts, and the user can switch it while it runs.
    try { return String(prop.global.i18n.iso639_1); } catch (e) { return ''; }
}

function parse(text) {
    var table = Object.create(null);
    var id = null;
    text.split(/\r?\n/).forEach(function(line) {
        var match = /^(id|msg): ?(.*)$/.exec(line);
        if (!match) return;
        if (match[1] === 'id') id = match[2];
        else if (id !== null) { table[id] = match[2]; id = null; }
    });
    return table;
}

function table(lang) {
    if (!(lang in tables)) {
        try { tables[lang] = parse(String(fs.readFileSync(Plugin.path + 'lang/' + lang + '.lang'))); }
        catch (e) { tables[lang] = Object.create(null); }
    }
    return tables[lang];
}

exports.t = function(text, arg) {
    var lang = language();
    var out = /^[a-z]{2}$/.test(lang) && lang !== 'en' && table(lang)[text] || text;
    // A function keeps $&, $' and similar in arg literal (search queries, Twitch error text).
    return arg === undefined ? out : out.replace('%s', function() { return arg; });
};

// Set as page.metadata.i18n on every page that uses the plugin's views.
exports.viewText = function() {
    var text = {};
    Object.keys(viewKeys).forEach(function(key) { text[key] = exports.t(viewKeys[key]); });
    return text;
};
exports.viewKeys = viewKeys;
