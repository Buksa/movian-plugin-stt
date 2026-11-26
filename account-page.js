'use strict';

var account = require('./account');
var prop = require('movian/prop');
var popup = require('native/popup');
var t = require('./i18n').t;
var activeLogin;

module.exports = function(page) {
    var timer;
    function cancel() {
        if (activeLogin === cancel) activeLogin = null;
        if (timer !== undefined) {
            clearTimeout(timer);
            timer = undefined;
        }
        if (!prop.isZombie(page.root)) page.metadata.accountCode = null;
    }
    function active() { return activeLogin === cancel && !prop.isZombie(page.root); }
    function status(message) { page.metadata.detail = message; }
    function action(label, handler) {
        page.appendAction(label, function() {
            try { handler(); }
            catch (e) { cancel(); if (!prop.isZombie(page.root)) status(e.message || String(e)); }
        });
    }
    if (activeLogin) activeLogin();
    status(account.login() ? t('Logged in as %s', account.login()) : t('Log in to open the full category catalog.'));
    page.onEvent('TwitchCancelLogin', function() {
        if (!active()) return;
        cancel();
        status(t('Code login cancelled.'));
    });
    action(t('Log in with a code'), function() {
        var id = account.clientId();
        if (activeLogin) activeLogin();
        activeLogin = cancel;
        status(t('Requesting a code from Twitch…'));
        var challenge = account.start(id);
        if (!active()) return;
        var expires = Date.now() + challenge.expires_in * 1000;
        var interval = Math.max(5, Number(challenge.interval) || 5);
        page.metadata.accountCode = challenge.user_code;
        status(t('On your phone open twitch.tv/activate?public=true and enter the code.'));
        function tick() {
            if (!active()) return;
            timer = undefined;
            try {
                if (Date.now() >= expires) throw new Error(t('The code expired. Request a new one.'));
                var result = account.poll(id, challenge.device_code);
                if (!active()) return;
                if (result.token) {
                    if (!account.complete(id, result.token, active)) return;
                    cancel();
                    status(t('Logged in as %s. Open “Categories”.', account.login()));
                    return;
                }
                if (result.status === 'access_denied') throw new Error(t('Login denied.'));
                if (result.status === 'slow_down') interval += 5;
                timer = setTimeout(tick, interval * 1000);
            } catch (e) {
                if (active()) { cancel(); status(e.message || String(e)); }
            }
        }
        timer = setTimeout(tick, interval * 1000);
    });
    action(t('Set Public Client ID'), function() {
        var answer = popup.textDialog(t('Public Client ID (leave empty for the built-in one)'), true, true);
        if (answer.rejected) return;
        var id = String(answer.input || '').trim();
        if (id && !/^[a-z0-9]{20,64}$/i.test(id)) { status(t('Enter a Public Client ID, not a secret.')); return; }
        cancel();
        account.setClientId(id);
        status(account.login() ? t('Logged in as %s', account.login()) : t('Choose “Log in with a code”.'));
    });
    action(t('Log out / cancel login'), function() {
        cancel();
        account.logout();
        status(t('Twitch account disconnected.'));
    });
};
