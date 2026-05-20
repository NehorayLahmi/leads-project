import express, { Application, Request, Response, NextFunction } from "express";
import { config } from "./config/env";
import router from "./routes";
import cors from "cors";
const app: Application = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: process.env.FRONTEND_URL, 
  credentials: true 
}));
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", env: config.nodeEnv });
});

app.use("/api", router);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: "Internal server error" });
});

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port} [${config.nodeEnv}]`);
});

export default app;
