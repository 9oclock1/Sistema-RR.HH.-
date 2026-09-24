# Aclaracion

## Turnos

- Las horas están en hora de Bolivia (UTC-4).
- Si `hora_fin` < `hora_inicio`, el turno cruza la medianoche; la jornada es la del día de inicio.
- Horas efectivas = duración del turno - `minutos_refrigerio`.
- Un marcaje es puntual si ocurre hasta `hora_inicio` + `minutos_tolerancia` (inclusive).

## Asignaciones de turno

- El campo id_empleado debería hacer referencia a id_empleado de EmployeeDB.
- No se puede eliminar un turno con asignaciones (`ON DELETE RESTRICT`); se lo puede desactivar con `esta_activo`.
