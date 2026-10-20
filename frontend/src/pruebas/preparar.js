import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// <dialog> en jsdom no implementa showModal/close: se simulan para que los modales abran y cierren.
if (typeof HTMLDialogElement !== "undefined") {
  HTMLDialogElement.prototype.showModal ??= function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function close() {
    this.removeAttribute("open");
  };
}

afterEach(() => {
  cleanup();
  try {
    localStorage.clear();
  } catch {
    // Sin almacenamiento no hay nada que limpiar.
  }
});
