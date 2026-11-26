#!/bin/sh
# The whole check: unit tests, Duktape syntax of every JS file, GLW parse of every entry view.
# movian-analyze runs Movian's own JS compiler and GLW preprocessor/parser, so a view that
# would crash Movian (e.g. Buksa/movian#296) fails here instead of on the TV.
set -e
cd "$(dirname "$0")/.."

core="${MOVIAN_CORE:-$(mdev core)}"
analyze="$core/build.debug/movian-analyze"
if [ ! -x "$analyze" ]; then
    echo "check: $analyze not found; build the Movian core (or set MOVIAN_CORE)" >&2
    exit 2
fi

node test/parsers.test.js
for js in *.js; do "$analyze" --js "$js" >/dev/null || { echo "check: $js does not compile in Duktape" >&2; exit 1; }; done
# Entry views only: an #include'd view (quality-menu.view) uses its includer's macros.
for view in views/catalog.view views/player.view; do
    "$analyze" --check --root . --skin "$core/glwskins/flat" "$view" >/dev/null ||
        { echo "check: $view does not parse in GLW" >&2; exit 1; }
done
echo "check: ok"
