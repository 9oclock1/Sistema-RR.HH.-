import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Pasos from "./Pasos";

const PASOS = [
  { id: "uno", etiqueta: "Plantilla" },
  { id: "dos", etiqueta: "Fechas" },
  { id: "tres", etiqueta: "Alcance" },
];

describe("Pasos", () => {
  it("muestra los pasos numerados en una lista con nombre accesible", () => {
    render(<Pasos pasos={PASOS} actual="dos" etiqueta="Pasos de prueba" />);
    const lista = screen.getByRole("list", { name: "Pasos de prueba" });
    expect(lista.querySelectorAll("li")).toHaveLength(3);
    expect(screen.getByText("Plantilla")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("marca solo el paso actual con aria-current y anuncia los completados", () => {
    render(<Pasos pasos={PASOS} actual="dos" />);
    const items = screen.getAllByRole("listitem");
    expect(items[0]).not.toHaveAttribute("aria-current");
    expect(items[1]).toHaveAttribute("aria-current", "step");
    expect(items[2]).not.toHaveAttribute("aria-current");
    expect(items.map((item) => item.dataset.estado)).toEqual(["completado", "actual", "pendiente"]);
    expect(screen.getByText("(completado)")).toBeInTheDocument();
  });

  it("sin onSeleccionar ningún paso es un botón", () => {
    render(<Pasos pasos={PASOS} actual="tres" />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("con onSeleccionar solo los pasos completados se pueden reabrir", async () => {
    const usuario = userEvent.setup();
    const alSeleccionar = vi.fn();
    render(<Pasos pasos={PASOS} actual="tres" onSeleccionar={alSeleccionar} />);

    const botones = screen.getAllByRole("button");
    expect(botones).toHaveLength(2);
    await usuario.click(screen.getByRole("button", { name: /Plantilla/ }));
    expect(alSeleccionar).toHaveBeenCalledWith("uno");
    await usuario.click(screen.getByRole("button", { name: /Fechas/ }));
    expect(alSeleccionar).toHaveBeenLastCalledWith("dos");
  });

  it("el paso actual y los pendientes no se pueden elegir", () => {
    render(<Pasos pasos={PASOS} actual="dos" onSeleccionar={() => {}} />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Fechas/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Alcance/ })).not.toBeInTheDocument();
  });
});
