import { createBrowserRouter, Navigate } from "react-router";
import MainLayout from "../layouts/MainLayout";
import MarcajePage from "../features/marcaje/MarcajePage";
import TurnosPage from "../features/turnos/TurnosPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <MainLayout />,
    children: [
      { index: true, element: <Navigate to="/asistencia/turnos" replace /> },
      { path: "asistencia/marcaje", element: <MarcajePage /> },
      { path: "asistencia/turnos", element: <TurnosPage /> },
    ],
  },
]);
