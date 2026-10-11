# Aclaracion

## Turnos

- Las horas están en hora de Bolivia (UTC-4).
- Si `hora_fin` < `hora_inicio`, el turno cruza la medianoche; la jornada es la del día de inicio.
- Horas efectivas = duración del turno - `minutos_refrigerio`.
- Un marcaje es puntual si ocurre hasta `hora_inicio` + `minutos_tolerancia` (inclusive).

## Asignaciones de turno

- El campo id_empleado debería hacer referencia a id_empleado de EmployeeDB.
- No se puede eliminar un turno con asignaciones (`ON DELETE RESTRICT`); se lo puede desactivar con `esta_activo`.

## Marcajes

- El campo id_empleado debería hacer referencia a id_empleado de EmployeeDB.
- `fecha_hora_marcaje` la pone el servidor de base de datos, nunca el cliente.
- `fecha_jornada` es la fecha en hora de Bolivia al momento del marcaje; la salida toma la de su entrada.
- Un empleado tiene como máximo un marcaje por tipo (entrada o salida) en cada jornada (`uq_marcaje_empleado_tipo_jornada`).
- El origen indica cómo se tomó la marca: portal o biométrico. `codigo_dispositivo` solo se llena en marcajes biométricos.
- La salida cierra la entrada de la jornada en curso: la de hoy o, si la del día anterior sigue abierta y tiene menos de 16 horas, esa (turnos que cruzan la medianoche).
- Sin entrada abierta, una salida marcada hace menos de 8 horas cuenta como ya registrada y no se guarda otra.
- Horas trabajadas = salida - entrada en minutos completos, sin descontar el refrigerio.
- Estado del marcaje (`CATALOGOS_ESTADO_MARCAJE`): `REGISTRADO` o `PENDIENTE_JUSTIFICACION`. Una salida sin entrada en la jornada se guarda como pendiente de justificación, no tiene horas trabajadas y cierra la jornada: no se acepta una entrada posterior.

## Verificación del empleado

- Antes de marcar se consulta `GET /empleados/:id` en EmployeeService (`EMPLOYEE_SERVICE_URL`). Se espera `{ id_empleado, nombres, apellidos, activo }` y 404 si el empleado no existe.
- Solo se permite marcar si `activo` es `true`. Si EmployeeService no responde, el marcaje se rechaza (503) y no se guarda nada.
- EmployeeService ya expone ese endpoint (KAN-39), así que el valor por defecto es `EMPLEADOS_SIMULADOS=false`. Con `true` se usa la lista fija de `src/config/empleadosSimulados.js` (solo para pruebas sin EmployeeService).

## Roles de turnos rotativos

- `ROLES_TURNO.id_sucursal` e `id_departamento` deberían hacer referencia a `SUCURSALES` y `DEPARTAMENTOS` de EmployeeDB (el área operativa).
- Un rol es semanal (lunes a domingo) o mensual (del 1 al último día del mes). Un área de una sucursal no puede tener dos roles con días en común (`ex_rol_sin_solapamiento`, requiere la extensión `btree_gist`).
- `ASIGNACIONES_ROL_TURNO` es el borrador que edita el supervisor: por empleado y día, un turno o un descanso (`id_turno` NULL y `es_descanso` TRUE). Una celda sin fila está vacía.
- Al publicar, el borrador se copia a `TURNOS_PUBLICADOS` con el nombre y el horario del turno de ese momento. Es lo que ve el colaborador; los cambios posteriores al borrador no se ven hasta publicar de nuevo (`tiene_cambios_sin_publicar`, `version_publicada`).
- Un empleado tiene un solo turno publicado por día (`uq_turno_publicado_empleado_fecha`), aunque figure en roles de dos áreas.

## Eventos salientes

- `EVENTOS_SALIENTES` guarda, en la misma transacción que la publicación, los avisos para otros módulos (patrón outbox). Un proceso los envía después y reintenta si fallan.
- `topico` indica el destino; `carga` es el cuerpo JSON que se envía. Estados: `PENDIENTE`, `ENTREGADO`, `FALLIDO` (agotó los reintentos).
- Al publicar un rol de un área de producción o de reparto se registra un evento `ROL_TURNOS_PUBLICADO` por tópico. El área se reconoce por su código en EmployeeDB:
  - `AREAS_PRODUCCION` (panadería, fraccionamiento…) → tópico `produccion-logistica` (Producción y Logística).
  - `AREAS_REPARTO` (choferes de reparto) → tópico `entregas-despachos` (Gestión de Entregas y Despachos).
- La carga trae el periodo, la sucursal, el área, la disponibilidad por día (cuántos en mañana, tarde, noche y descanso) y el turno de cada colaborador. Cada nueva publicación del rol genera eventos nuevos con la versión.
- Si el tópico tiene URL (`URL_PRODUCCION_LOGISTICA`, `URL_ENTREGAS_DESPACHOS`), el despachador hace `POST` con la carga y las cabeceras `X-Evento-Id` y `X-Topico`; una respuesta 2xx lo marca como entregado. Reintenta con espera creciente (30 s, 1 min, 2 min… hasta 1 h) y tras 8 intentos queda fallido.
- Sin URL, el módulo puede leer los eventos con `GET /eventos?topico=&estado=PENDIENTE` y confirmarlos con `POST /eventos/:id/confirmar`. Los consumidores deben ignorar un `X-Evento-Id` ya procesado (un evento puede llegar más de una vez).
