import { createBrowserRouter } from "react-router";
import MainLayout from "../layouts/MainLayout";
import InicioPage from "../features/inicio/InicioPage";
import PaginaModulo from "../features/inicio/PaginaModulo";
import PaginaNoEncontrada from "../features/inicio/PaginaNoEncontrada";
import { SECCIONES } from "./modulos";

const modulos = SECCIONES.flatMap((seccion) => seccion.modulos.map((modulo) => ({ seccion, modulo })));

const rutasModulos = modulos
  .filter(({ modulo }) => !modulo.publica)
  .map(({ seccion, modulo }) => ({
    path: modulo.parametroOpcional ? `${modulo.ruta}/:${modulo.parametroOpcional}?` : modulo.ruta,
    element: <PaginaModulo key={modulo.ruta} seccion={seccion.titulo} modulo={modulo} />,
  }));

const rutasPublicas = modulos
  .filter(({ modulo }) => modulo.publica)
  .map(({ modulo: { ruta, pagina: Pagina } }) => ({ path: ruta, element: <Pagina /> }));

export const router = createBrowserRouter([
  ...rutasPublicas,
  {
    path: "/",
    element: <MainLayout />,
    children: [{ index: true, element: <InicioPage /> }, ...rutasModulos, { path: "*", element: <PaginaNoEncontrada /> }],
  },
]);
