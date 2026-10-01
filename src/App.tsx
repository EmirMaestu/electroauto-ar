import { lazy } from "react";
import { createBrowserRouter, RouterProvider } from "react-router";
import { Shell } from "./components/layout/Shell";
import { Home } from "./pages/Home";
import { Ruta } from "./pages/Ruta";
import { PartPage } from "./pages/PartPage";
import { LessonPage } from "./pages/LessonPage";
import { NotFound } from "./pages/NotFound";

const Banco = lazy(() => import("./pages/Banco"));
const BancoTester = lazy(() => import("./pages/BancoTester"));
const BancoOsciloscopio = lazy(() => import("./pages/BancoOsciloscopio"));
const BancoMotor = lazy(() => import("./pages/BancoMotor"));
const Calculadoras = lazy(() => import("./pages/Calculadoras"));
const Herramientas = lazy(() => import("./pages/Herramientas"));
const Casos = lazy(() => import("./pages/Casos"));
const Caso = lazy(() => import("./pages/Caso"));
const Practica = lazy(() => import("./pages/Practica"));
const Biblioteca = lazy(() => import("./pages/Biblioteca"));
const Gnc = lazy(() => import("./pages/Gnc"));
const Progreso = lazy(() => import("./pages/Progreso"));
const Glosario = lazy(() => import("./pages/Glosario"));

const router = createBrowserRouter([
  {
    path: "/",
    element: <Shell />,
    children: [
      { index: true, element: <Home /> },
      { path: "ruta", element: <Ruta /> },
      { path: "aprender/:partId", element: <PartPage /> },
      { path: "aprender/:partId/:lessonId", element: <LessonPage /> },
      { path: "banco", element: <Banco /> },
      { path: "banco/tester", element: <BancoTester /> },
      { path: "banco/osciloscopio", element: <BancoOsciloscopio /> },
      { path: "banco/motor", element: <BancoMotor /> },
      { path: "banco/calculadoras", element: <Calculadoras /> },
      { path: "herramientas", element: <Herramientas /> },
      { path: "casos", element: <Casos /> },
      { path: "casos/:id", element: <Caso /> },
      { path: "practica", element: <Practica /> },
      { path: "biblioteca", element: <Biblioteca /> },
      { path: "gnc", element: <Gnc /> },
      { path: "progreso", element: <Progreso /> },
      { path: "glosario", element: <Glosario /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
