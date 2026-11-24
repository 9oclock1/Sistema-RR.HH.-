#!/usr/bin/env bash
# Regenera las imágenes de los diagramas de la épica 10 a partir de sus fuentes PlantUML (.puml).
# Vista general en SVG y diagramas detallados en PNG, como en la documentación de EmployeeService.
# Requisitos: Java 8+ y plantuml.jar (https://plantuml.com/download), o el comando "plantuml" instalado.
# Si el jar está en otra ruta: export PLANTUML_JAR="/ruta/plantuml.jar"
set -euo pipefail
cd "$(dirname "$0")"

if command -v plantuml >/dev/null 2>&1; then
  plantuml_cmd=(plantuml)
else
  jar="${PLANTUML_JAR:-plantuml.jar}"
  if [ ! -f "$jar" ]; then
    echo "No se encontró plantuml.jar. Descárguelo o defina PLANTUML_JAR." >&2
    exit 1
  fi
  plantuml_cmd=(java -jar "$jar")
fi

"${plantuml_cmd[@]}" -charset UTF-8 -tsvg general/*.puml
echo "listo: general (SVG)"
"${plantuml_cmd[@]}" -charset UTF-8 -tpng detallados/*.puml
echo "listo: detallados (PNG)"
