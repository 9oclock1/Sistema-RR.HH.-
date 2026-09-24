import { createBrowserRouter, Navigate } from "react-router";
import MainLayout from "../layouts/MainLayout";
import TurnosPage from "../features/turnos/TurnosPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <MainLayout />,
    children: [
      { index: true, element: <Navigate to="/asistencia/turnos" replace /> },
      { path: "asistencia/turnos", element: <TurnosPage /> },
    ],
  },
]);
