# Backend Tiempo Real (`backend-realtime`)

Servidor independiente en **Node.js + TypeScript + Socket.IO** encargado de:
- Sincronización de presencia en salas de estudio (`room:join`, `room:leave`, `room:users`).
- Enrutamiento de mensajes de chat en tiempo real (`chat:message`).
- Señalización WebRTC (`webrtc:signal`, `media:toggle`) para audio, video y compartición de pantalla con `simple-peer` y ExpressTURN.

---

## Configuración y Ejecución Local

1. Copiar variables de entorno:
   ```bash
   cp .env.example .env
   ```
2. Instalar dependencias y levantar en modo desarrollo:
   ```bash
   npm install
   npm run dev
   ```
3. Verificar estado del servicio en:
   - `http://localhost:4001/health`

---

## Ejecución con Docker

```bash
docker build -t studyroom-backend-realtime .
docker run -p 4001:4001 --env-file .env studyroom-backend-realtime
```

---

## Despliegue en Render

1. Crear un **Web Service** en Render.
2. Configurar **Root Directory**: `backend-realtime` y **Environment**: `Docker`.
3. Definir `PORT=4001` y `CORS_ORIGIN=https://tu-app.vercel.app`.
