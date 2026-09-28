import express from "express";
import cors from "cors";
import convocatoriaRoutes from "./routes/convocatoriaRoutes.js";
import postulacionRoutes from "./routes/postulacionRoutes.js";
import cvTestRoutes from "./routes/cvTestRoutes.js";
import { errorHandler } from "./middlewares/errorHandler.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas para las funcionalidades
app.use("/convocatorias", convocatoriaRoutes);
app.use("/postulaciones", postulacionRoutes);
app.use("/cv", cvTestRoutes);

app.use(errorHandler);

export default app;
