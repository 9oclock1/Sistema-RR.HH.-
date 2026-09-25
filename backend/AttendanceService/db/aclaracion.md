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
- `fecha_jornada` es la fecha en hora de Bolivia al momento del marcaje.
- Un empleado tiene como máximo un marcaje por tipo (entrada o salida) en cada jornada (`uq_marcaje_empleado_tipo_jornada`).
- El origen indica cómo se tomó la marca: portal o biométrico. `codigo_dispositivo` solo se llena en marcajes biométricos.
