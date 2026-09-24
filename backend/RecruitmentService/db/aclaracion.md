# Aclaracion

Dentro de la base de datos se encuentras las siguientes observaciones que deben ser tomadas a consideración al momento de llenar los datos y saber a que conectar y a qué no:

## Convocatorias

- El campo id_cargo_referencial debería hacer referencia a un campo similar a id_cargo proporcionado por EmployeeDB.
- El campo id_sucursal_destino debería hacer referencia a un campo similar a id_sucursal proporcionado por EmployeeDB.

## POSTULACIONES

- El campo id_empleado_generado debería hacer referencia a un campo similar a id_empleado proporcionado por EmployeeDB. (Si bien puede ser redundante nos sirve para la trazabilidad interna del servicio).
- Los campos id_convocatoria e id_postulante en su conjunto son unicos ya que no deben haber postulaciones duplicadas a la misma vacante.

## Historiales de etapa de postulación

- El campo id_usuario_evaluador debería hacer referencia a un campo similar a id_usuario evaluador proporcionado por AuthDB.

## Entrevistas

- El campo id_entrevistador_empleado debería hacer referencia a un campo similar a id_empleado proporcionado por EmployeeDB.
