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
    'movian/store': {create: function() { return saved; }}
};
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

console.log('ok');
