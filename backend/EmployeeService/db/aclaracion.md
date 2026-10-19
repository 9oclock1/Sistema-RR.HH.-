# Aclaracion

Dentro de la base de datos se encuentra las siguientes observaciones que deben ser tomadas a consideración al momento de llenar los datos, ya que algunas cosas son unicas:

## Postulaciones de ascenso

- Los campos id_convocatoria e id_empleado en su conjunto son unicos ya que no deben haber postulaciones duplicadas a la misma vacante.

## Requisitos de capacitacion para un cargo

- Los campos id_cargo e id_curso en su conjunto son unicos ya que no deben haber requisitos de cursos duplicados para el mismo cargo.

## Acuse de recibo de memorándums (RF-39)

- El plazo de acuse (fecha_limite_acuse) corre desde que el aviso llegó al portal del colaborador (fecha_hora_notificacion), no desde la fecha de emisión; si NotificationService no responde al emitir, el memorándum queda con fue_notificado en false y el job de EmployeeService reintenta el aviso.
- Los campos fecha_hora_acuse, ip_acuse e id_usuario_acuse se llenan juntos y una sola vez, cuando el colaborador acusa recibo; el acuse no se puede modificar después.
- El campo estado_acuse vale PENDIENTE, RECIBIDO («Notificado y Recibido») o VENCIDO (venció el plazo sin acuse y ya se alertó a RRHH en fecha_hora_alerta_rrhh). Un memorándum VENCIDO todavía puede recibir el acuse y pasa a RECIBIDO.
- El campo id_usuario_acuse debería hacer referencia a un campo similar a id_usuario proporcionado por AuthDB; mientras no exista inicio de sesión guarda el id del empleado.
