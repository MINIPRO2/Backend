# StudyRoom — Backend (`MINIPRO2/Backend`)

Repositorio de servicios de servidor para **StudyRoom (Salón de Estudio Colaborativo en Tiempo Real)**, organizado con arquitectura separada y contenerizada con Docker.

---

## Estructura del Repositorio

```text
backend/
├── backend-api/          # API REST principal (Node.js + TypeScript + Express + Cloud Firestore + Swagger)
│   ├── src/
│   │   ├── config/       # Inicialización de Firebase Admin SDK y especificación OpenAPI/Swagger
│   │   ├── routes/       # Capa de Rutas HTTP (/api/sprint0/status)
│   │   ├── services/     # Capa de Lógica de Negocio (Sprint0Service)
│   │   ├── repositories/ # Capa de Acceso a Datos en Cloud Firestore (Sprint0Repository)
│   │   └── index.ts      # Punto de entrada del servidor Express
│   ├── .env.example      # Ejemplo de variables de entorno sin credenciales reales
│   └── Dockerfile        # Contenedor multi-etapa para despliegue en Render
├── backend-realtime/     # Servidor de Tiempo Real (Node.js + TypeScript + Socket.IO + Señalización WebRTC)
│   ├── src/
│   │   └── index.ts      # Servidor Socket.IO y eventos de sala/chat/WebRTC
│   ├── .env.example      # Variables de entorno de ejemplo (STUN/TURN y orígenes permitidos)
│   └── Dockerfile        # Contenedor multi-etapa para despliegue en Render
└── docker-compose.yml    # Levanta ambos servicios de backend con Docker Compose
```

---

## Ejecución en Local

### 1. Con Node.js / npm
```bash
# 1. Iniciar Backend API (Puerto 4000)
cd backend-api
cp .env.example .env
# Configurar FIREBASE_SERVICE_ACCOUNT_JSON en .env
npm install
npm run dev

# 2. Iniciar Backend Realtime (Puerto 4001)
cd ../backend-realtime
cp .env.example .env
npm install
npm run dev
```

### 2. Con Docker Compose
```bash
docker compose up --build
```

---

## Endpoints Principales (`backend-api`)

- **`GET /api/sprint0/status`**: Consulta en tiempo real el documento `system_status/sprint0` en Cloud Firestore a través de las 3 capas (`routes` $\rightarrow$ `services` $\rightarrow$ `repositories`).
- **`GET /api-docs`**: Documentación interactiva publicada con **Swagger UI**.
- **`GET /health`**: Verificación de salud del contenedor.
