# Aclaracion

Dentro de la base de datos se encuentran las siguientes observaciones que deben ser tomadas a consideración al momento de llenar los datos y saber a que conectar y a qué no:

## Comunicaciones

- El campo id_usuario_remitente debería hacer referencia a un campo similar a id_usuario proporcionado por AuthDB.
- Los campos id_departamento_destino e id_sucursal_destino deberían hacer referencia a campos similares a id_departamento e id_sucursal proporcionados por EmployeeDB.
- El campo requiere_confirmacion permite identificar si el comunicado necesita confirmación explícita de lectura por parte del empleado.
- Los campos asunto y contenido son obligatorios y no deben enviarse vacíos.

## Destinatarios de comunicación

- El campo id_empleado debería hacer referencia a un campo similar a id_empleado proporcionado por EmployeeDB.
- Los campos id_comunicacion e id_empleado en su conjunto son únicos ya que un empleado no debe recibir duplicado el mismo comunicado.
- El campo id_estado controla el estado del mensaje dentro de la bandeja del empleado (NO_LEIDO, LEIDO, CONFIRMADO).

## Lecturas de comunicación

- El campo id_empleado debería hacer referencia a un campo similar a id_empleado proporcionado por EmployeeDB.
- El campo fecha_apertura registra la fecha en la que el empleado accede al contenido del mensaje.
- El campo fecha_confirmacion solamente debe llenarse cuando la comunicación requiere confirmación obligatoria.

## Catálogos

- Los campos codigo de las tablas catalogos_tipo_comunicacion, catalogos_alcance_comunicacion y catalogos_estado_mensaje son únicos ya que no deben existir registros duplicados.
- Los catálogos permiten controlar los tipos de comunicación, alcance de distribución y estados de lectura utilizados por el microservicio.