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

# Aclaración ténica y Spike

## Evaluación de librerías de Parsing (.pdf y .docx)

- PDF: pdf-parse
  ventajas:
  - librería ligera
  - No tiene dependencias del sistema operativo
  - ejecución en buffers de memoria
    desventajas:
  - extrae texto digital/vectorial embebido (si el cv es una imagen escaneada o fue exportado como raster plano no extrae nada de informacion).
- DOCX: mammoth
  ventajas:
  - diseñada exclusivamente para word
  - retiene casi al 100% la información del documento

## Estrategia de extracción

- Paso 1: Se procesa el archivo mediante alguna de las librerías mencionadas anteriormente y se extrae el pipeline de texto plano.
- Paso 2: Evaluación de un threshold de carácteres:
  - Si el texto extraído supera los 200 carácteres, se envía el texto plano al LLM.
  - Si el texto plano es menor a 200 carácteres se procede a:
    - Se delega el análisis al canal de visión del modelo (como imagen a un LLM multimodal).
    - Se trata de extraer la información como una excepción controlada por ejemplo "estado_extraccion = fallida" y se habilita la carga manual desde el frontend.
