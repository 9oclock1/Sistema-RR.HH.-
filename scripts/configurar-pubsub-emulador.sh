#!/bin/bash
# Crea en el emulador local de Pub/Sub (servicio pubsub-emulator del docker-compose) los tópicos que los
# consumidores de CompensationService intentan suscribir al arrancar (confirmaciones de Contabilidad/Pagos,
# cierre de ventas de Ventas y Marketing). El tópico propio de RRHH (ucb-sis323-sub-f, el que de verdad se usa
# para publicar) ya se crea solo cuando arranca CompensationService; este script es solo para que esos otros
# consumidores no reintenten la suscripción cada 60 s por un tópico inexistente (ningún otro módulo existe en
# este sistema para crearlo de verdad). No usar contra el proyecto real de GCP.
set -e

HOST="${PUBSUB_EMULATOR_HOST:-localhost:8085}"
PROJECT="${PUBSUB_PROJECT_ID:-project-a96e5fe1-5ba6-4698-a85}"

crear_topico() {
  local topico="$1"
  echo "Creando tópico $topico..."
  curl -s -X PUT "http://${HOST}/v1/projects/${PROJECT}/topics/${topico}" > /dev/null
}

crear_topico "ucb-sis323-sub-f"  # RRHH (saliente): planilla y aguinaldo aprobados.
crear_topico "ucb-sis323-sub-d"  # Contabilidad (confirmaciones leídas por RRHH).
crear_topico "ucb-sis323-sub-a"  # Pagos (confirmaciones leídas por RRHH).
crear_topico "ucb-sis323-sub-e"  # Ventas y Marketing (cierre de ventas leído por RRHH).

echo "Listo. Reinicie compensation-service para que abra sus suscripciones: docker compose restart compensation-service"
