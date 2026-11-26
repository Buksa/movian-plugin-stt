# SmartTwitchTV (Movian plugin)

- **Check before commit:** `test/check.sh` (unit tests, Duktape compile of every JS file, GLW parse of the entry views). It is the pre-commit hook once `git config core.hooksPath .githooks` is set in the clone.
- **Run in Movian:** `mdev run --name stv -p <this folder>`, then `mdev open --name stv smarttwitchtv:<start|categories|favorites|account|play:live:<login>>`. The `stv` profile in `/tmp/mdev/stv` may hold a logged-in Twitch session.
- **Translations:** `docs/i18n.md` (lang/*.lang, `t()`, view text by id).
- **Movian plugin gotchas** (store write delay, page setup before network, language codes): the `movian` skills in `~/movian-plugin-sdk/plugins/movian/skills/`, `api/references/plugin-gotchas.md`.
