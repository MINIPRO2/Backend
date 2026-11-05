# Backend API Principal (`backend-api`)

Servicio RESTful construido con **Node.js + TypeScript + Express + Firebase Admin SDK (Firestore & Auth) + Swagger UI**.

> **Regla de Arquitectura (TS-00):** El `frontend` nunca consulta Firestore directamente. Toda operación sobre la base de datos pasa por este servicio.

---

## Requisitos Previos

- Node.js 20+
- Proyecto en **Firebase Console** con **Firestore Database** habilitado y una cuenta de servicio (*Service Account*).

---

## Configuración de Variables de Entorno

1. Copia el archivo de ejemplo:
   ```bash
   cp .env.example .env
   ```
2. En Firebase Console $\rightarrow$ *Configuración del proyecto* $\rightarrow$ *Cuentas de servicio* $\rightarrow$ *Generar nueva clave privada*.
3. Completa en `.env`:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY` (conservando los `\n` y entre comillas)
   - O bien pega el JSON completo en `FIREBASE_SERVICE_ACCOUNT_JSON`.

---

## Ejecución en Desarrollo

```bash
npm install
npm run dev
```

El servidor quedará disponible en:
- **Endpoint Base Técnica (TS-00)**: `http://localhost:4000/api/sprint0/status`
- **Healthcheck**: `http://localhost:4000/api/health`
- **Documentación Swagger**: `http://localhost:4000/api-docs`

---

## Ejecución con Docker

```bash
docker build -t studyroom-backend-api .
docker run -p 4000:4000 --env-file .env studyroom-backend-api
```

---

## Despliegue en Render

1. Crear un nuevo **Web Service** en Render conectado al repositorio de GitHub.
2. Configurar:
   - **Root Directory**: `backend-api`
   - **Environment**: `Docker`
   - **Variables de Entorno**: `PORT=4000`, `CORS_ORIGIN=https://tu-app.vercel.app`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.
