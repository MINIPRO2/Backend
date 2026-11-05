import express, { Request, Response } from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server, Socket } from 'socket.io';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 4001;

app.use(cors());
app.use(express.json());

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    service: 'studyroom-backend-realtime',
    connectedClients: io.engine.clientsCount,
    timestamp: new Date().toISOString(),
  });
});

io.on('connection', (socket: Socket) => {
  console.log(`[backend-realtime] Cliente conectado: ${socket.id}`);

  socket.on('room:join', (payload: { roomId: string; displayName?: string }) => {
    if (!payload?.roomId) return;
    socket.join(payload.roomId);
    socket.to(payload.roomId).emit('room:user-joined', {
      socketId: socket.id,
      displayName: payload.displayName || 'Estudiante',
      joinedAt: new Date().toISOString(),
    });
  });

  socket.on(
    'chat:message',
    (payload: { roomId: string; content: string; senderName: string }) => {
      if (!payload?.roomId || !payload?.content) return;
      io.to(payload.roomId).emit('chat:message', {
        id: `${Date.now()}-${socket.id}`,
        roomId: payload.roomId,
        content: payload.content,
        senderName: payload.senderName || 'Estudiante',
        createdAt: new Date().toISOString(),
      });
    }
  );

  socket.on(
    'webrtc:signal',
    (payload: { targetSocketId: string; signal: unknown }) => {
      if (!payload?.targetSocketId) return;
      io.to(payload.targetSocketId).emit('webrtc:signal', {
        senderSocketId: socket.id,
        signal: payload.signal,
      });
    }
  );

  socket.on('disconnect', () => {
    console.log(`[backend-realtime] Cliente desconectado: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[backend-realtime] Servidor Socket.IO escuchando en el puerto ${PORT}`);
});
