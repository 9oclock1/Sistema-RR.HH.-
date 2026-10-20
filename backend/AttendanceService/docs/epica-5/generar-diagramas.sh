#!/usr/bin/env bash
# Regenera las imágenes (SVG y PNG) de los diagramas de la épica 5 a partir de sus fuentes .mmd.
# Requisitos: Node.js y un navegador Chromium (Chrome, Edge o Brave).
# Si el conversor no encuentra el navegador: export PUPPETEER_EXECUTABLE_PATH="/ruta/al/navegador"
set -euo pipefail
cd "$(dirname "$0")"

configuracion="$(mktemp)"
trap 'rm -f "$configuracion"' EXIT
echo '{"args":["--no-sandbox","--disable-gpu"]}' > "$configuracion"

for fuente in general/*.mmd detallados/*.mmd; do
  for formato in svg png; do
    npx --yes @mermaid-js/mermaid-cli -p "$configuracion" -i "$fuente" -o "${fuente%.mmd}.$formato" -b white -s 2 -q
  done
  echo "listo: $fuente"
done
