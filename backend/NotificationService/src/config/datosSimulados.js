// Datos simulados para desarrollo, pruebas de microservicio y fallback cuando EmployeeService / DB no estén disponibles.

const DEPARTAMENTOS = [
  {
    id_departamento: "11111111-1111-4111-a111-111111111111",
    codigo: "RRHH",
    nombre: "Recursos Humanos",
  },
  {
    id_departamento: "22222222-2222-4222-a222-222222222222",
    codigo: "OPER",
    nombre: "Operaciones y Logística",
  },
  {
    id_departamento: "33333333-3333-4333-a333-333333333333",
    codigo: "TI",
    nombre: "Tecnología de la Información",
  },
  {
    id_departamento: "44444444-4444-4444-a444-444444444444",
    codigo: "VENT",
    nombre: "Ventas y Atención al Cliente",
  },
  {
    // Grupo sin personal activo para validar RF-65 criterio 3
    id_departamento: "99999999-9999-4999-a999-999999999999",
    codigo: "AUDIT",
    nombre: "Auditoría Interna (Área sin empleados activos)",
  },
];

const SUCURSALES = [
  {
    id_sucursal: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
    codigo_sucursal: "SUC-01",
    nombre: "Sucursal Central (La Paz)",
    ciudad: "La Paz",
  },
  {
    id_sucursal: "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb",
    codigo_sucursal: "SUC-02",
    nombre: "Sucursal Calacoto",
    ciudad: "La Paz",
  },
  {
    id_sucursal: "cccccccc-cccc-4ccc-cccc-cccccccccccc",
    codigo_sucursal: "SUC-03",
    nombre: "Sucursal El Alto",
    ciudad: "El Alto",
  },
  {
    // Sucursal sin personal activo para validar RF-65 criterio 3
    id_sucursal: "dddddddd-dddd-4ddd-dddd-dddddddddddd",
    codigo_sucursal: "SUC-04",
    nombre: "Sucursal Villa Fátima (Sin personal activo)",
    ciudad: "La Paz",
  },
];

const EMPLEADOS = [
  {
    id_empleado: "4192f252-acf0-4522-a109-e051cad9a50b",
    nombres: "Ana",
    apellidos: "Quispe Mamani",
    cargo: "Analista de Personal",
    id_departamento: "11111111-1111-4111-a111-111111111111", // RRHH
    id_sucursal: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa", // Central
    activo: true,
  },
  {
    id_empleado: "cb7995a6-4b23-4738-ab8b-37d0b203d73b",
    nombres: "Luis",
    apellidos: "Rojas Vargas",
    cargo: "Supervisor de Logística",
    id_departamento: "22222222-2222-4222-a222-222222222222", // Operaciones
    id_sucursal: "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb", // Calacoto
    activo: true,
  },
  {
    id_empleado: "e1a2b3c4-d5e6-4789-a012-3456789abcde",
    nombres: "Carlos",
    apellidos: "Mendoza Calle",
    cargo: "Desarrollador de Sistemas",
    id_departamento: "33333333-3333-4333-a333-333333333333", // TI
    id_sucursal: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa", // Central
    activo: true,
  },
  {
    id_empleado: "f2b3c4d5-e6f7-4890-b123-456789abcdef",
    nombres: "Elena",
    apellidos: "Gómez Prado",
    cargo: "Cajera Principal",
    id_departamento: "44444444-4444-4444-a444-444444444444", // Ventas
    id_sucursal: "cccccccc-cccc-4ccc-cccc-cccccccccccc", // El Alto
    activo: true,
  },
  {
    // Empleado inactivo para probar RF-64 criterio 4
    id_empleado: "d97320a7-c29b-4405-a33b-a48dc65c6090",
    nombres: "Carla",
    apellidos: "Flores Choque",
    cargo: "Ex Asistente Comercial",
    id_departamento: "44444444-4444-4444-a444-444444444444",
    id_sucursal: "cccccccc-cccc-4ccc-cccc-cccccccccccc",
    activo: false,
  },
];

module.exports = {
  DEPARTAMENTOS,
  SUCURSALES,
  EMPLEADOS,
};
