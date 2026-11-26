// Run: node test/parsers.test.js — checks the playlist parser and saved-quality choice outside Movian.
'use strict';
var assert = require('assert');
var Module = require('module');

var playlist = '';
var saved = {};
var stubs = {
    'movian/http': {request: function() {
        return {statuscode: 200, toString: function() { return playlist; }};
    }},
    'native/faprovider': {register: function() {}},
    'movian/store': {create: function() { return saved; }},
    'movian/prop': {global: {i18n: {iso639_1: 'ru'}}},
    fs: Object.create(require('fs'), {writeFileSync: {value: function(file, text) { disk[file] = JSON.parse(text); }}})
};
var disk = {};
global.Core = {storagePath: '/movian'};
global.Plugin = {path: require('path').join(__dirname, '..') + '/'}; // i18n.js reads lang/ from here
var load = Module._load;
Module._load = function(name) { return stubs[name] || load.apply(this, arguments); };
var live = require('../live');
var quality = require('../quality');

var cdn = 'https://video-weaver.fra05.hls.ttvnw.net/v1/playlist/';
playlist = [
    '#EXTM3U',
    '#EXT-X-MEDIA:TYPE=VIDEO,GROUP-ID="chunked",NAME="1080p60 (source)"',
    '#EXT-X-STREAM-INF:BANDWIDTH=8000000,RESOLUTION=1920x1080,CODECS="avc1.64002A,mp4a.40.2",VIDEO="chunked",FRAME-RATE=60.000',
    cdn + 'src.m3u8',
    '#EXT-X-STREAM-INF:BANDWIDTH=6000000,RESOLUTION=1920x1080,CODECS="hvc1.1.6.L120,mp4a.40.2",VIDEO="hevc"',
    cdn + 'hevc.m3u8',
    '#EXT-X-STREAM-INF:BANDWIDTH=3000000,RESOLUTION=1280x720,CODECS="avc1.4D401F,mp4a.40.2",VIDEO="720p60"',
    cdn + '720p60.m3u8',
    '#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1280x720,CODECS="avc1.4D401F,mp4a.40.2",VIDEO="720p30",FRAME-RATE=30.000',
    cdn + '720p30.m3u8',
    '#EXT-X-STREAM-INF:BANDWIDTH=1400000,RESOLUTION=852x480,CODECS="avc1.4D401F,mp4a.40.2",VIDEO="480p30"',
    'https://evil.example.com/480p.m3u8',
    '#EXT-X-STREAM-INF:BANDWIDTH=160000,CODECS="mp4a.40.2",VIDEO="audio_only"',
    cdn + 'audio.m3u8',
    ''
].join('\r\n');

var choices = live.variants('https://usher.ttvnw.net/x.m3u8', true);
assert.deepStrictEqual(choices.items.map(function(v) { return v.label; }),
    ['Источник · 1080p60', '720p60', '720p30']);
assert.strictEqual(choices.initial, 1, 'live starts at the best variant up to 720p');
assert.strictEqual(live.variants('https://usher.ttvnw.net/x.m3u8', false).initial, 0, 'VOD starts at source');
assert.strictEqual(choices.items[1].url, 'smarttwitch-media://3000000/' + encodeURIComponent(cdn + '720p60.m3u8') +
    '/live.m3u8');

assert.strictEqual(quality.initial(choices), 1, 'nothing saved: provider default');
saved.quality = {label: '720p30', height: 720, fps: 30};
assert.strictEqual(quality.initial(choices), 2, 'exact label');
saved.quality = {label: 'Источник · 720p30', height: 720, fps: 30};
assert.strictEqual(quality.initial(choices), 2, 'same height and fps');
saved.quality = {label: '900p60', height: 900, fps: 60};
assert.strictEqual(quality.initial(choices), 1, 'next lower height');
saved.quality = {label: '360p30', height: 360, fps: 30};
assert.strictEqual(quality.initial(choices), 1, 'below all: first of the lowest height');

quality.remember(choices.items[0]);
assert.deepStrictEqual(saved.quality, {label: 'Источник · 1080p60', height: 1080, fps: 60});

// Login polling: transient failures keep polling, a rejected code stops it.
var account = require('../account');
var replies = [
    function() { throw new Error('network down'); },
    function() { return {statuscode: 503, toString: function() { return '<html>busy</html>'; }}; },
    function() { return {statuscode: 400, toString: function() { return '{"message":"authorization_pending"}'; }}; }
];
stubs['movian/http'].request = function() { return replies.shift()(); };
assert.deepStrictEqual(account.poll('id', 'code'), {status: 'authorization_pending'}, 'network error');
assert.deepStrictEqual(account.poll('id', 'code'), {status: 'authorization_pending'}, 'HTML 503');
assert.deepStrictEqual(account.poll('id', 'code'), {status: 'authorization_pending'}, 'real pending');
replies.push(function() { return {statuscode: 400, toString: function() { return '{"message":"invalid device code"}'; }}; });
assert.throws(function() { account.poll('id', 'code'); }, /HTTP 400/);

// A second page asking for credentials while the hourly check waits on the network gets the live session.
delete require.cache[require.resolve('../account')];
saved.session = {clientId: 'cid', login: 'me', accessToken: 'a', refreshToken: 'r', expires: Date.now() + 3600000};
account = require('../account');
var inner;
function json(body) { return {statuscode: 200, toString: function() { return JSON.stringify(body); }}; }
stubs['movian/http'].request = function(url) {
    if (url.indexOf('/validate') !== -1) {
        inner = account.catalog('games/top', {});
        return json({client_id: 'cid', login: 'me'});
    }
    return json({data: [{id: '1'}]});
};
assert.deepStrictEqual(account.catalog('games/top', {}).nodes, [{id: '1'}]);
assert.deepStrictEqual(inner.nodes, [{id: '1'}], 'concurrent caller is not rejected');

// An expired token is refreshed and the rotated refresh token is stored, or the next refresh logs the user out.
delete require.cache[require.resolve('../account')];
saved.session = {clientId: 'cid', login: 'me', userId: '42', accessToken: 'old', refreshToken: 'r1', expires: Date.now() - 1000};
account = require('../account');
stubs['movian/http'].request = function(url, options) {
    if (url.indexOf('/token') !== -1) {
        assert.strictEqual(options.postdata.refresh_token, 'r1');
        return json({access_token: 'a2', refresh_token: 'r2', expires_in: 14000});
    }
    if (url.indexOf('/validate') !== -1) return json({client_id: 'cid', login: 'me'});
    assert.strictEqual(options.headers.Authorization, 'Bearer a2');
    return json({data: []});
};
account.catalog('games/top', {});
assert.strictEqual(saved.session.refreshToken, 'r2', 'rotated refresh token is saved');
assert.strictEqual(disk['/movian/store/account'].session.refreshToken, 'r2', 'and on disk at once');
assert.strictEqual(saved.session.accessToken, 'a2');
assert.strictEqual(account.userId(), '42', 'refresh keeps the user id the follows list needs');

// Login asks for the follows scope and stores the Twitch user id.
stubs['movian/http'].request = function(url, options) {
    if (url.indexOf('/device') !== -1) {
        assert.strictEqual(options.postdata.scopes, 'user:read:follows');
        return json({device_code: 'd', user_code: 'ABCD1234', expires_in: 1800});
    }
    return json({client_id: account.clientId(), login: 'me', user_id: '77'});
};
account.start(account.clientId());
assert.ok(account.complete(account.clientId(), {access_token: 'a', refresh_token: 'r', expires_in: 100},
    function() { return true; }));
assert.strictEqual(account.userId(), '77');

// GraphQL: one retry on Twitch's transient "service error", then give up.
var twitch = require('../twitch');
var gqlReplies = [];
stubs['movian/http'].request = function() { return json(gqlReplies.shift()); };
var failed = {data: null, errors: [{message: 'service error'}]};
gqlReplies.push(failed, {data: {game: {id: '1', slug: 'x'}}});
assert.strictEqual(twitch.category('x').slug, 'x', 'retried once');
gqlReplies.push(failed, failed);
assert.throws(function() { twitch.category('x'); }, /service error/);

// Pasted links: main.js is a Movian script, not a module, so run it in a sandbox and read its top-level function.
var vm = require('vm');
var fs = require('fs');
var path = require('path');
function Stub() {}
var sandbox = {Plugin: {path: ''}, console: console, require: function(name) {
    return {Route: Stub, Searcher: Stub, create: function() { return {}; }};
}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8'), sandbox);
var links = {
    'https://www.twitch.tv/videos/123?t=1h': 'smarttwitchtv:play:vod:123',
    'https://clips.twitch.tv/FunnyClip-abc_1': 'smarttwitchtv:play:clip:FunnyClip-abc_1',
    'https://www.twitch.tv/Some_User/clip/FunnyClip': 'smarttwitchtv:play:clip:FunnyClip',
    'https://www.twitch.tv/directory/category/just-chatting': 'smarttwitchtv:category:just-chatting',
    'https://m.twitch.tv/Some_User': 'smarttwitchtv:channel:some_user',
    'https://twitch.tv/some_user/videos?filter=archives': 'smarttwitchtv:channel:some_user',
    'https://www.twitch.tv/directory': 'smarttwitchtv:search:' + encodeURIComponent('https://www.twitch.tv/directory'),
    'https://www.twitch.tv/settings/profile': 'smarttwitchtv:search:' + encodeURIComponent('https://www.twitch.tv/settings/profile'),
    'https://www.twitch.tv/directoryfan': 'smarttwitchtv:channel:directoryfan',
    'just chatting': 'smarttwitchtv:search:just%20chatting'
};
Object.keys(links).forEach(function(link) { assert.strictEqual(sandbox.destination(link), links[link], link); });

// i18n: every t('...') key and every view key has an entry in lang/ru.lang; other languages get English.
var i18n = require('../i18n');
var keys = ['Streams', 'Videos', 'Clips']; // main.js sections, translated through a variable
['main.js', 'account.js', 'account-page.js', 'twitch.js', 'live.js'].forEach(function(file) {
    var source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    (source.match(/\bt\('(?:[^'\\]|\\.)*'/g) || []).forEach(function(call) { keys.push(call.slice(3, -1)); });
});
Object.keys(i18n.viewKeys).forEach(function(id) { keys.push(i18n.viewKeys[id]); });
keys.forEach(function(key) { assert.notStrictEqual(i18n.t(key), key, 'no Russian in lang/ru.lang for ' + key); });
// Every language file has every key, with the same placeholders.
fs.readdirSync(path.join(__dirname, '../lang')).forEach(function(file) {
    var text = fs.readFileSync(path.join(__dirname, '../lang', file), 'utf8');
    var table = {};
    text.replace(/^id: (.*)\nmsg: (.*)$/gm, function(_, id, msg) { table[id] = msg; });
    keys.forEach(function(key) {
        assert.ok(key in table, file + ': missing ' + key);
        assert.strictEqual(table[key].split('%s').length, key.split('%s').length, file + ': placeholders in ' + key);
    });
});
stubs['movian/prop'].global.i18n.iso639_1 = 'sp';
assert.strictEqual(i18n.t('Search'), 'Buscar', "Movian's Spanish reports sp; it reads lang/es.lang");
stubs['movian/prop'].global.i18n.iso639_1 = 'it';
assert.strictEqual(i18n.t('Channel: %s', 'x'), 'Canale: x');
stubs['movian/prop'].global.i18n.iso639_1 = 'ru';
assert.strictEqual(i18n.t('Channel: %s', 'x'), 'Канал: x');
assert.strictEqual(i18n.t('Twitch search: %s', "$& $' x"), "Поиск Twitch: $& $' x", '$ patterns stay literal');
assert.strictEqual(i18n.viewText().navSearch, 'Поиск');
stubs['movian/prop'].global.i18n.iso639_1 = 'de';
assert.strictEqual(i18n.t('Channel: %s', 'x'), 'Channel: x', 'a language without a file falls back to English');
stubs['movian/prop'].global.i18n.iso639_1 = '../x';
assert.strictEqual(i18n.t('Videos'), 'Videos', 'odd language codes never reach the file path');
stubs['movian/prop'].global.i18n.iso639_1 = 'ru';

console.log('ok');
