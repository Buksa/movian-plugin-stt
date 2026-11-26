'use strict';

var http = require('movian/http');
var t = require('./i18n').t;
var endpoint = 'https://gql.twitch.tv/gql';
var clientId = 'kimne78kx3ncx6brgo4mv6wki5h1ko'; // Public identifier of the Twitch web client, not an OAuth token.
var playbackParams = '{platform:"web",playerBackend:"mediaplayer",playerType:"site"}';
var userFields = 'login displayName profileImageURL(width:70)';
var gameFields = 'id slug displayName boxArtURL(width:288,height:384) channelsCount viewersCount';
var streamFields = 'title viewersCount previewImageURL(width:640,height:360) language createdAt game{slug name}';
var videoFields = 'id title lengthSeconds previewThumbnailURL viewCount language owner{login displayName}';
var clipFields = 'slug title durationSeconds thumbnailURL viewCount language broadcaster{login displayName}';
var lists = { streams: streamFields + ' broadcaster{' + userFields + '}', games: gameFields,
              videos: videoFields, clips: clipFields };

function gql(selection, selectItems, retried) {
    var response;
    try {
        response = http.request(endpoint, {
            method: 'POST',
            postdata: JSON.stringify({query: '{' + selection + '}'}),
            headers: {'Client-ID': clientId, 'Content-Type': 'application/json'},
            verifySSL: true,
            noFollow: true,
            noFail: true
        });
    } catch (e) {
        throw new Error(t('Could not connect to Twitch: %s', e.message));
    }
    if (response.statuscode !== 200) {
        throw new Error(t('Twitch returned HTTP %s', response.statuscode));
    }
    var body = JSON.parse(response.toString());
    // Catalog queries can keep usable items when only some branches failed.
    var items = body.data && selectItems ? selectItems(body.data) : null;
    if (!body.data || ((body.errors && body.errors.length) && !(items && items.length))) {
        var message = body.errors && body.errors[0] && body.errors[0].message;
        // Twitch fails a query now and then with "service error" and serves it a moment later.
        if (message === 'service error' && !retried) return gql(selection, selectItems, true);
        throw new Error(t('Twitch API error') + (message ? ': ' + message : ''));
    }
    return selectItems ? items : body.data;
}

function parentField(scope, key) {
    if (scope === 'channel') return 'user(login:' + JSON.stringify(key) + ')';
    if (scope === 'category') {
        var id = /^id-([0-9]+)$/.exec(key);
        return id ? 'game(id:' + JSON.stringify(id[1]) + ')' : 'game(slug:' + JSON.stringify(key) + ')';
    }
    throw new Error(t('Unknown Twitch section.'));
}

exports.list = function(kind, scope, key, limit) {
    var selection = kind + '(first:' + limit + '){pageInfo{hasNextPage} edges{node{' + lists[kind] + '}}}';
    var result = scope ? gql('parent:' + parentField(scope, key) + '{' + selection + '}').parent : gql(selection);
    if (!result) throw new Error(t('Channel or category not found.'));
    var connection = result[kind];
    var edges = connection && connection.edges || [];
    var nodes = [];
    for (var i = 0; i < edges.length; i++) {
        if (edges[i] && edges[i].node) nodes.push(edges[i].node);
    }
    return {nodes: nodes, hasMore: !!(connection && connection.pageInfo && connection.pageInfo.hasNextPage)};
};

exports.gameStats = function(ids) {
    var stats = Object.create(null);
    // Twitch GraphQL accepts at most 15 root aliases in a single request.
    for (var i = 0; i < ids.length; i += 15) {
        var selection = ids.slice(i, i + 15).map(function(id) {
            return 'g' + id + ':game(id:' + JSON.stringify(id) + '){viewersCount channelsCount}';
        }).join(' ');
        var batch;
        try {
            batch = gql(selection);
        } catch (e) {
            console.warn('Twitch: category stats unavailable: ' + e.message);
            continue;
        }
        Object.keys(batch).forEach(function(key) { stats[key] = batch[key]; });
    }
    return stats;
};

exports.popularGames = function() {
    var data = gql('games(first:100){edges{node{id}}}');
    return (data.games && data.games.edges || []).map(function(edge) {
        return edge && edge.node && edge.node.id;
    }).filter(function(id) { return /^\d+$/.test(id); });
};

exports.popularMedia = function(kind, ids) {
    var order = kind === 'clips' ? ',criteria:{period:LAST_WEEK}' : ',sort:VIEWS';
    var field = kind + '(first:6' + order + '){edges{node{' + lists[kind] + '}}}';
    var selection = ids.map(function(id) {
        return 'g' + id + ':game(id:' + JSON.stringify(id) + '){' + field + '}';
    }).join(' ');
    return gql(selection, function(data) {
        var nodes = [];
        ids.forEach(function(id) {
            var game = data['g' + id];
            var list = game && game[kind];
            (list && list.edges || []).forEach(function(edge) {
                var node = edge && edge.node;
                if (node && (kind === 'clips' ? node.slug : node.id)) nodes.push(node);
            });
        });
        return nodes.sort(function(a, b) { return b.viewCount - a.viewCount; });
    });
};

exports.users = function(logins) {
    if (!logins.length) return [];
    var users = gql('users(logins:' + JSON.stringify(logins) + '){' + userFields + ' stream{id}}').users || [];
    return users.filter(function(user) { return user && user.login; });
};

exports.channel = function(login) {
    var user = gql(parentField('channel', login) + '{id ' + userFields + ' stream{' + streamFields + '}}').user;
    if (!user) throw new Error(t('Twitch channel not found.'));
    return user;
};

exports.category = function(slug) {
    var game = gql(parentField('category', slug) + '{' + gameFields + '}').game;
    if (!game) throw new Error(t('Twitch category not found.'));
    return game;
};

exports.search = function(query) {
    return gql('searchFor(userQuery:' + JSON.stringify(query) + ',platform:"web"){' +
        'channels{edges{item{... on User{' + userFields + ' stream{id}}}}}' +
        'games{edges{item{... on Game{' + gameFields + '}}}}}').searchFor;
};

function queryString(args) {
    return Object.keys(args).map(function(key) {
        return key + '=' + encodeURIComponent(args[key]);
    }).join('&');
}

function hls(kind, id, token) {
    if (!token || !token.signature || !token.value) throw new Error(t('Twitch did not allow playback.'));
    var live = kind === 'live';
    var args = {sig: token.signature, token: token.value, allow_source: 'true',
                p: Math.floor(Math.random() * 1000000), player: 'twitchweb'};
    if (live) args.supported_codecs = 'avc1';
    return 'https://usher.ttvnw.net/' + (live ? 'api/channel/hls/' : 'vod/') + id + '.m3u8?' + queryString(args);
}

exports.play = function(kind, id) {
    var target = JSON.stringify(id);
    var params = ',params:' + playbackParams + '){signature value}';
    var data, clip;
    if (kind === 'live') {
        data = gql(parentField('channel', id) + '{displayName stream{title}}' +
            'access:streamPlaybackAccessToken(channelName:' + target + params);
        if (!data.user || !data.user.stream) throw new Error(t('The channel is offline.'));
        return {title: data.user.stream.title || data.user.displayName, url: hls(kind, id, data.access)};
    }
    if (kind === 'vod') {
        data = gql('video(id:' + target + '){title}' +
            'access:videoPlaybackAccessToken(id:' + target + params);
        if (!data.video) throw new Error(t('The Twitch video was deleted or is unavailable.'));
        return {title: data.video.title || t('Twitch video'), url: hls(kind, id, data.access)};
    }
    clip = gql('clip(slug:' + target + '){title playbackAccessToken(params:' + playbackParams +
        '){signature value} videoQualities{quality frameRate sourceURL}}').clip;
    if (!clip) throw new Error(t('The Twitch clip was deleted or is unavailable.'));
    var token = clip.playbackAccessToken;
    if (!token || !token.signature || !token.value) throw new Error(t('The clip cannot be played.'));
    var auth = queryString({sig: token.signature, token: token.value});
    var items = [];
    var seen = Object.create(null);
    (clip.videoQualities || []).forEach(function(q) {
        if (!q || !/^\d+$/.test(q.quality) || !/^https:\/\//i.test(q.sourceURL || '')) return;
        var fps = Math.round(Number(q.frameRate) || 0);
        var label = q.quality + 'p' + (fps ? fps : '');
        if (seen[label]) return;
        seen[label] = true;
        items.push({label: label, height: Number(q.quality), fps: fps, url: q.sourceURL +
            (q.sourceURL.indexOf('?') === -1 ? '?' : '&') + auth});
    });
    if (!items.length) throw new Error(t('The clip cannot be played.'));
    items.sort(function(a, b) { return b.height - a.height || b.fps - a.fps; });
    return {title: clip.title || t('Twitch clip'), items: items, initial: 0};
};
