import { createBrowserRouter } from "react-router";
import MainLayout from "../layouts/MainLayout";
import InicioPage from "../features/inicio/InicioPage";
import PaginaModulo from "../features/inicio/PaginaModulo";
import PaginaNoEncontrada from "../features/inicio/PaginaNoEncontrada";
import { SECCIONES } from "./modulos";

const rutasModulos = SECCIONES.flatMap((seccion) =>
  seccion.modulos.map((modulo) => ({
    path: modulo.ruta,
    element: <PaginaModulo key={modulo.ruta} seccion={seccion.titulo} modulo={modulo} />,
  })),
);

export const router = createBrowserRouter([
  {
    path: "/",
    element: <MainLayout />,
    children: [{ index: true, element: <InicioPage /> }, ...rutasModulos, { path: "*", element: <PaginaNoEncontrada /> }],
  },
]);
