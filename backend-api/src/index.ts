import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import sprint0Router from './routes/sprint0.routes';
import userRouter from './routes/user.routes';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 4000;

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
  : ['*'];

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.includes('*') ||
        allowedOrigins.includes(origin)
      ) {
        callback(null, true);
      } else {
        callback(null, true); // Permite pruebas desde despliegues preview de Vercel
      }
    },
    credentials: true,
  })
);

app.use(express.json());

// Documentación Swagger (TS-00)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Endpoint de salud general
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    service: 'studyroom-backend-api',
    timestamp: new Date().toISOString(),
  });
});

// Rutas del Sprint 0 (TS-00 Base Técnica End-to-End)
app.use('/api/sprint0', sprint0Router);

// Rutas del Sprint 1 (TS-01 Identidad y Autenticación)
app.use('/api/users', userRouter);

// Ruta raíz informativa
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    service: 'Salón de Estudio Colaborativo - Backend API',
    status: 'online',
    docs: '/api-docs',
    sprint0Endpoint: '/api/sprint0/status',
    sprint1Endpoints: [
      'GET /api/users/check-username?username=...',
      'GET /api/users/me',
      'POST /api/users/register',
      'POST /api/users/google-sync',
      'PUT /api/users/username',
      'PUT /api/users/profile',
    ],
  });
});

app.listen(PORT, () => {
  console.log(`[backend-api] Servidor escuchando en el puerto ${PORT}`);
  console.log(`[backend-api] Swagger UI disponible en http://localhost:${PORT}/api-docs`);
});
