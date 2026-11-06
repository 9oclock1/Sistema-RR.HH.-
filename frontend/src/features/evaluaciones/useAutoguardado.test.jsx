import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useAutoguardado, { RETRASO_AUTOGUARDADO_MS } from "./useAutoguardado";

// Promesa que se resuelve o rechaza a mano, para controlar cuándo termina un guardado.
const pendiente = () => {
  let resolver;
  let rechazar;
  const promesa = new Promise((res, rej) => {
    resolver = res;
    rechazar = rej;
  });
  return { promesa, resolver, rechazar };
};

const avanzar = (ms) => act(async () => vi.advanceTimersByTimeAsync(ms));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("Autoguardado: cuándo guarda", () => {
  it("no guarda en cada cambio: junta lo que el usuario toca y lo envía cuando se detiene", async () => {
    const guardar = vi.fn(async () => ({}));
    const { result } = renderHook(() => useAutoguardado({ guardar }));

    act(() => {
      result.current.encolar("p1", "nivel-a");
      result.current.encolar("p1", "nivel-b");
      result.current.encolar("p2", "nivel-c");
    });
    expect(result.current.estado).toBe("pendiente");

    await avanzar(RETRASO_AUTOGUARDADO_MS - 1);
    expect(guardar).not.toHaveBeenCalled();

    await avanzar(1);
    expect(guardar).toHaveBeenCalledTimes(1);
    // De la misma pregunta solo cuenta lo último que eligió.
    expect(guardar).toHaveBeenCalledWith([
      { id_pregunta: "p1", id_nivel: "nivel-b" },
      { id_pregunta: "p2", id_nivel: "nivel-c" },
    ]);
    expect(result.current.estado).toBe("guardado");
    expect(result.current.guardadoEn).toBeInstanceOf(Date);
  });

  it("cada cambio reinicia la espera: mientras sigue tocando no guarda", async () => {
    const guardar = vi.fn(async () => ({}));
    const { result } = renderHook(() => useAutoguardado({ guardar }));

    act(() => result.current.encolar("p1", "a"));
    await avanzar(600);
    act(() => result.current.encolar("p2", "b"));
    await avanzar(600);
    expect(guardar).not.toHaveBeenCalled();

    await avanzar(200);
    expect(guardar).toHaveBeenCalledTimes(1);
    expect(guardar.mock.calls[0][0]).toHaveLength(2);
  });

  it("un borrado (id_nivel null) también se guarda", async () => {
    const guardar = vi.fn(async () => ({}));
    const { result } = renderHook(() => useAutoguardado({ guardar }));

    act(() => result.current.encolar("p1", null));
    await avanzar(RETRASO_AUTOGUARDADO_MS);
    expect(guardar).toHaveBeenCalledWith([{ id_pregunta: "p1", id_nivel: null }]);
  });
});

describe("Autoguardado: un solo envío a la vez", () => {
  it("lo que cambia mientras se guarda sale en la vuelta siguiente, sin envíos simultáneos", async () => {
    const primero = pendiente();
    const guardar = vi.fn().mockReturnValueOnce(primero.promesa).mockResolvedValue({});
    const { result } = renderHook(() => useAutoguardado({ guardar }));

    act(() => result.current.encolar("p1", "a"));
    await avanzar(RETRASO_AUTOGUARDADO_MS);
    expect(guardar).toHaveBeenCalledTimes(1);
    expect(result.current.estado).toBe("guardando");

    act(() => result.current.encolar("p2", "b"));
    await avanzar(RETRASO_AUTOGUARDADO_MS * 2);
    expect(guardar, "no empieza otro guardado hasta que termine el primero").toHaveBeenCalledTimes(1);

    await act(async () => primero.resolver({}));
    expect(guardar).toHaveBeenCalledTimes(2);
    expect(guardar).toHaveBeenLastCalledWith([{ id_pregunta: "p2", id_nivel: "b" }]);
    expect(result.current.estado).toBe("guardado");
  });
});

describe("Autoguardado: cuando falla", () => {
  it("avisa del error y conserva lo que no se guardó para reintentarlo", async () => {
    const guardar = vi.fn().mockRejectedValueOnce(new Error("sin conexión")).mockResolvedValue({});
    const { result } = renderHook(() => useAutoguardado({ guardar }));

    act(() => result.current.encolar("p1", "a"));
    await avanzar(RETRASO_AUTOGUARDADO_MS);
    expect(result.current.estado).toBe("error");
    expect(result.current.error.message).toBe("sin conexión");

    await act(async () => result.current.reintentar());
    expect(guardar).toHaveBeenCalledTimes(2);
    expect(guardar).toHaveBeenLastCalledWith([{ id_pregunta: "p1", id_nivel: "a" }]);
    expect(result.current.estado).toBe("guardado");
    expect(result.current.error).toBeNull();
  });

  it("si el usuario cambió la misma pregunta después, el reintento envía lo más nuevo, no lo viejo", async () => {
    const fallo = pendiente();
    const guardar = vi.fn().mockReturnValueOnce(fallo.promesa).mockResolvedValue({});
    const { result } = renderHook(() => useAutoguardado({ guardar }));

    act(() => result.current.encolar("p1", "viejo"));
    await avanzar(RETRASO_AUTOGUARDADO_MS);
    act(() => result.current.encolar("p1", "nuevo"));
    await act(async () => fallo.rechazar(new Error("falló")));

    await avanzar(RETRASO_AUTOGUARDADO_MS);
    expect(guardar).toHaveBeenLastCalledWith([{ id_pregunta: "p1", id_nivel: "nuevo" }]);
  });

  it("con un error definitivo (p. ej. evaluación ya enviada) descarta los cambios y no reintenta", async () => {
    const guardar = vi.fn().mockRejectedValue(Object.assign(new Error("ya enviada"), { estado: 409 }));
    const esDefinitivo = (error) => error.estado === 409;
    const { result } = renderHook(() => useAutoguardado({ guardar, esDefinitivo }));

    act(() => result.current.encolar("p1", "a"));
    await avanzar(RETRASO_AUTOGUARDADO_MS);
    expect(result.current.estado).toBe("error");

    await act(async () => result.current.reintentar());
    expect(guardar, "no queda nada por reintentar").toHaveBeenCalledTimes(1);
  });
});

describe("Autoguardado: guardar ahora y al salir", () => {
  it("guardarAhora envía lo pendiente sin esperar el retraso", async () => {
    const guardar = vi.fn(async () => ({}));
    const { result } = renderHook(() => useAutoguardado({ guardar }));

    act(() => result.current.encolar("p1", "a"));
    await act(async () => result.current.guardarAhora());
    expect(guardar).toHaveBeenCalledTimes(1);

    await avanzar(RETRASO_AUTOGUARDADO_MS * 2);
    expect(guardar, "el temporizador ya no vuelve a guardar lo mismo").toHaveBeenCalledTimes(1);
  });

  it("guardarAhora sin nada pendiente no llama al servidor", async () => {
    const guardar = vi.fn(async () => ({}));
    const { result } = renderHook(() => useAutoguardado({ guardar }));
    await act(async () => result.current.guardarAhora());
    expect(guardar).not.toHaveBeenCalled();
  });

  it("guardarAhora rechaza si no se pudo guardar, para no enviar la evaluación a medias", async () => {
    const guardar = vi.fn().mockRejectedValue(new Error("sin conexión"));
    const { result } = renderHook(() => useAutoguardado({ guardar }));

    act(() => result.current.encolar("p1", "a"));
    let error;
    await act(async () => {
      await result.current.guardarAhora().catch((e) => {
        error = e;
      });
    });
    expect(error.message).toBe("sin conexión");
  });

  it("al salir de la pantalla intenta guardar lo que quedó pendiente", async () => {
    const guardar = vi.fn(async () => ({}));
    const { result, unmount } = renderHook(() => useAutoguardado({ guardar }));

    act(() => result.current.encolar("p1", "a"));
    unmount();
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(guardar).toHaveBeenCalledTimes(1);
    expect(guardar).toHaveBeenCalledWith([{ id_pregunta: "p1", id_nivel: "a" }]);
  });

  it("el navegador avisa antes de cerrar la pestaña solo mientras hay cambios sin guardar", async () => {
    const guardar = vi.fn(async () => ({}));
    const { result } = renderHook(() => useAutoguardado({ guardar }));
    const cerrar = () => {
      const evento = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(evento);
      return evento.defaultPrevented;
    };

    expect(cerrar()).toBe(false);
    act(() => result.current.encolar("p1", "a"));
    expect(cerrar()).toBe(true);

    await avanzar(RETRASO_AUTOGUARDADO_MS);
    expect(result.current.estado).toBe("guardado");
    expect(cerrar()).toBe(false);
  });
});
