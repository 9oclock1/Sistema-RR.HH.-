import { MemoryRouter } from 'react-router';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCargos } from '../../api/cargosApi';
import { getEmpleados } from '../../api/empleadosApi';
import { ApiError } from '../../api/httpClient';
import { asignarPlanAscenso, formalizarAscenso, getPlanesAscenso } from '../../api/planesAscensoApi';
import ProveedorAvisos from '../../components/ui/ProveedorAvisos';
import { cambiarRol } from '../../context/sesion';
import PlanesAscensoPage from './PlanesAscensoPage';

vi.mock('../../api/planesAscensoApi');
vi.mock('../../api/empleadosApi');
vi.mock('../../api/cargosApi');

const curso = (codigo, nombre, estado, cambios = {}) => ({
  id_curso: `curso-${codigo}`,
  codigo,
  nombre,
  horas_academicas: 16,
  es_obligatorio: true,
  meses_validez_requerida: null,
  estado,
  motivo: estado === 'PENDIENTE' ? 'Sin registro en el Kardex.' : null,
  certificado: null,
  ...cambios,
});

const plan = (id, nombre, porcentaje, cursos, cambios = {}) => {
  const cumplidos = cursos.filter((c) => c.estado === 'CUMPLIDO').length;
  return {
    id_plan: id,
    estado: 'EN_CURSO',
    observaciones: null,
    empleado: {
      id_empleado: `emp-${id}`,
      nombre_completo: nombre,
      cargo_actual: { id_cargo: 'cajero', nombre: 'Cajero' },
      sucursal_actual: { id_sucursal: 'sop', nombre: 'Sopocachi' },
    },
    cargo_destino: { id_cargo: 'supervisor', nombre: 'Supervisor de Cajas', area: 'Atención al cliente' },
    avance: { cursos_requeridos: cursos.length, cursos_cumplidos: cumplidos, cursos_pendientes: cursos.length - cumplidos, porcentaje },
    cursos,
    formalizacion: null,
    ...cambios,
  };
};

const ANA = plan('p-ana', 'Ana Torrez', 66.67, [
  curso('ARQ', 'Arqueo de caja', 'CUMPLIDO', {
    certificado: { institucion_emisora: 'Instituto Financiero', fecha_emision: '2025-06-18', fecha_vencimiento: null },
  }),
  curso('LID', 'Liderazgo de equipos', 'CUMPLIDO'),
  curso('SEG', 'Seguridad y primeros auxilios', 'PENDIENTE', { motivo: 'El certificado venció el 2026-05-10: debe renovarlo.' }),
]);
const DIEGO = plan('p-diego', 'Diego Quispe', 0, [curso('ARQ', 'Arqueo de caja', 'PENDIENTE')]);

const ADVERTENCIA = {
  error: 'Advertencia: …',
  codigo: 'CURSOS_PENDIENTES',
  advertencia: 'Ana Torrez tiene 1 curso pendiente del plan para «Supervisor de Cajas»: Seguridad y primeros auxilios.',
  cursos_pendientes: [{ codigo: 'SEG', nombre: 'Seguridad y primeros auxilios', motivo: 'El certificado venció el 2026-05-10: debe renovarlo.' }],
  avance: ANA.avance,
};

const montar = () =>
  render(
    <MemoryRouter>
      <ProveedorAvisos>
        <PlanesAscensoPage />
      </ProveedorAvisos>
    </MemoryRouter>,
  );

const abrirPlan = async (nombre) => {
  await userEvent.click(await screen.findByRole('button', { name: `Ver el plan de ${nombre}` }));
  return screen.findByRole('dialog', { name: `Plan de ${nombre}` });
};

describe('Planes de ascenso', () => {
  beforeEach(() => {
    cambiarRol('admin');
    getPlanesAscenso.mockResolvedValue({ planes: [ANA, DIEGO], total: 2 });
    getEmpleados.mockResolvedValue([
      { id_empleado: 'emp-luis', nombre_completo: 'Luis Vargas', cargo: 'Cajero', id_cargo: 'cajero', activo: true },
      { id_empleado: 'emp-elena', nombre_completo: 'Elena Paredes', cargo: 'Cajero', id_cargo: 'cajero', activo: false },
    ]);
    getCargos.mockResolvedValue([
      { id_cargo: 'cajero', nombre: 'Cajero' },
      { id_cargo: 'supervisor', nombre: 'Supervisor de Cajas' },
    ]);
  });

  it('criterio 4: muestra el porcentaje de avance de cada candidato', async () => {
    montar();

    const barraAna = await screen.findByRole('progressbar', { name: 'Avance del plan de Ana Torrez' });
    expect(barraAna.getAttribute('aria-valuenow')).toBe('66.67');
    expect(screen.getByText('66,67 %')).toBeTruthy();
    expect(screen.getByText('2 de 3 cursos obligatorios cumplidos')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Avance del plan de Diego Quispe' }).getAttribute('aria-valuenow')).toBe('0');
    expect(getPlanesAscenso).toHaveBeenCalledWith({ estado: 'EN_CURSO', rol: 'admin' });
  });

  it('el filtro de estado vuelve a pedir el seguimiento', async () => {
    montar();
    await screen.findByText('66,67 %');
    await userEvent.selectOptions(screen.getByLabelText('Mostrar'), 'TODOS');
    await waitFor(() => expect(getPlanesAscenso).toHaveBeenLastCalledWith({ estado: 'TODOS', rol: 'admin' }));
  });

  it('criterio 1: el detalle lista los cursos requeridos con su estado pendiente o cumplido', async () => {
    montar();
    const dialogo = await abrirPlan('Ana Torrez');

    const cursos = within(within(dialogo).getByRole('list', { name: 'Cursos requeridos por el cargo' })).getAllByRole('listitem');
    expect(cursos).toHaveLength(3);
    expect(cursos[0].textContent).toContain('Arqueo de caja');
    expect(cursos[0].textContent).toContain('Cumplido');
    expect(cursos[0].textContent).toContain('Instituto Financiero');
    expect(cursos[2].textContent).toContain('Pendiente');
    expect(cursos[2].textContent).toContain('El certificado venció el 2026-05-10: debe renovarlo.');
  });

  it('criterio 1: el Administrador asigna un plan a un empleado activo', async () => {
    asignarPlanAscenso.mockResolvedValue(plan('p-luis', 'Luis Vargas', 0, [curso('ARQ', 'Arqueo de caja', 'PENDIENTE')]));
    montar();

    const candidato = await screen.findByRole('combobox', { name: /^Candidato/ });
    await waitFor(() => expect(within(candidato).getAllByRole('option')).toHaveLength(2));
    expect(within(candidato).queryByText(/Elena Paredes/)).toBeNull();
    await userEvent.selectOptions(candidato, 'emp-luis');
    const destino = screen.getByRole('combobox', { name: /^Cargo destino/ });
    expect(within(destino).queryByRole('option', { name: 'Cajero' })).toBeNull();
    await userEvent.selectOptions(destino, 'supervisor');
    await userEvent.click(screen.getByRole('button', { name: 'Asignar plan' }));

    await waitFor(() =>
      expect(asignarPlanAscenso).toHaveBeenCalledWith(
        { id_empleado: 'emp-luis', id_cargo_destino: 'supervisor', observaciones: undefined },
        expect.objectContaining({ rol: 'admin' }),
      ),
    );
    expect(await screen.findByText('Plan de ascenso asignado')).toBeTruthy();
  });

  it('muestra el motivo cuando el cargo no tiene capacitaciones requeridas', async () => {
    asignarPlanAscenso.mockRejectedValue(
      new ApiError('El cargo «Cajero» no tiene capacitaciones requeridas: no hay un plan que seguir.', 409, { codigo: 'CARGO_SIN_CAPACITACIONES' }),
    );
    getCargos.mockResolvedValue([{ id_cargo: 'jefe', nombre: 'Jefe de Atención' }]);
    montar();

    const candidato = await screen.findByRole('combobox', { name: /^Candidato/ });
    await waitFor(() => expect(within(candidato).getAllByRole('option')).toHaveLength(2));
    await userEvent.selectOptions(candidato, 'emp-luis');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /^Cargo destino/ }), 'jefe');
    await userEvent.click(screen.getByRole('button', { name: 'Asignar plan' }));

    expect(await screen.findByText(/no tiene capacitaciones requeridas/)).toBeTruthy();
  });

  it('criterio 3: con cursos pendientes muestra la advertencia y solo formaliza si se confirma', async () => {
    formalizarAscenso
      .mockRejectedValueOnce(new ApiError(ADVERTENCIA.error, 409, ADVERTENCIA))
      .mockResolvedValueOnce({
        ...ANA,
        estado: 'FORMALIZADO',
        advertencia: ADVERTENCIA.advertencia,
        formalizacion: { cursos_pendientes: 1, con_pendientes: true, formalizado_en: '2026-11-22T20:00:00Z' },
      });
    montar();
    const dialogo = await abrirPlan('Ana Torrez');

    await userEvent.click(within(dialogo).getByRole('button', { name: 'Formalizar ascenso' }));
    const confirmacion = await screen.findByRole('dialog', { name: 'El candidato tiene cursos pendientes' });
    expect(within(confirmacion).getByText(ADVERTENCIA.advertencia)).toBeTruthy();
    expect(within(confirmacion).getByRole('list', { name: 'Cursos pendientes' }).textContent).toContain('Seguridad y primeros auxilios');
    expect(formalizarAscenso).toHaveBeenLastCalledWith('p-ana', { confirmar_pendientes: false }, expect.anything());

    await userEvent.click(within(confirmacion).getByRole('button', { name: 'Formalizar de todos modos' }));
    await waitFor(() =>
      expect(formalizarAscenso).toHaveBeenLastCalledWith('p-ana', { confirmar_pendientes: true }, expect.anything()),
    );
    expect(await screen.findByText('Ascenso formalizado')).toBeTruthy();
  });

  it('cancelar la advertencia no formaliza el ascenso', async () => {
    formalizarAscenso.mockRejectedValueOnce(new ApiError(ADVERTENCIA.error, 409, ADVERTENCIA));
    montar();
    const dialogo = await abrirPlan('Ana Torrez');

    await userEvent.click(within(dialogo).getByRole('button', { name: 'Formalizar ascenso' }));
    const confirmacion = await screen.findByRole('dialog', { name: 'El candidato tiene cursos pendientes' });
    await userEvent.click(within(confirmacion).getByRole('button', { name: 'Cancelar' }));

    expect(formalizarAscenso).toHaveBeenCalledTimes(1);
  });

  it('la gerencia consulta el seguimiento pero no asigna planes ni formaliza ascensos', async () => {
    cambiarRol('gerente');
    montar();
    const dialogo = await abrirPlan('Ana Torrez');

    expect(screen.queryByRole('button', { name: 'Asignar plan' })).toBeNull();
    expect(within(dialogo).queryByRole('button', { name: 'Formalizar ascenso' })).toBeNull();
    expect(getEmpleados).not.toHaveBeenCalled();
  });
});
