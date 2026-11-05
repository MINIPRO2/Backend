export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Salón de Estudio Colaborativo - Backend API',
    version: '1.0.0',
    description:
      'API RESTful principal del Salón de Estudio Colaborativo en Tiempo Real. Gestiona la lectura y escritura en Firestore y la verificación de sesión con Firebase Authentication (Arquitectura separada TS-00).',
  },
  servers: [
    {
      url: '/',
      description: 'Servidor actual (Local / Render)',
    },
  ],
  tags: [
    {
      name: 'Sprint 0 - Base Técnica (TS-00)',
      description:
        'Endpoints de verificación de salud y lectura end-to-end desde Firestore',
    },
  ],
  paths: {
    '/api/health': {
      get: {
        tags: ['Sprint 0 - Base Técnica (TS-00)'],
        summary: 'Verifica que el servicio backend-api está activo',
        responses: {
          '200': {
            description: 'Servicio operativo',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean', example: true },
                    service: {
                      type: 'string',
                      example: 'studyroom-backend-api',
                    },
                    timestamp: {
                      type: 'string',
                      format: 'date-time',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/sprint0/status': {
      get: {
        tags: ['Sprint 0 - Base Técnica (TS-00)'],
        summary:
          'Lee el documento de estado end-to-end desde Firestore (system_status/sprint0)',
        description:
          'Consulta la colección `system_status` y documento `sprint0` en Firestore. Si el documento aún no existe, lo inicializa automáticamente para facilitar la validación end-to-end. Si se modifica el valor en la consola de Firestore y se recarga el frontend, el cambio se refleja inmediatamente.',
        responses: {
          '200': {
            description: 'Dato leído exitosamente desde Firestore',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean', example: true },
                    source: {
                      type: 'string',
                      example: 'Cloud Firestore (system_status/sprint0)',
                    },
                    data: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', example: 'sprint0' },
                        appName: {
                          type: 'string',
                          example: 'Salón de Estudio Colaborativo en Tiempo Real',
                        },
                        sprint: {
                          type: 'string',
                          example: 'Sprint 0 - Fundamentación UX y Base Técnica End-to-End',
                        },
                        message: {
                          type: 'string',
                          example:
                            'Conexión End-to-End verificada: Frontend (React) -> Backend API (Express) -> Cloud Firestore.',
                        },
                        accessibilityTarget: {
                          type: 'string',
                          example: 'WCAG 2.2 Nivel AA (Teclado + Lector de Pantalla)',
                        },
                        activeRoomsCount: { type: 'number', example: 3 },
                        updatedAt: {
                          type: 'string',
                          format: 'date-time',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '500': {
            description:
              'Error de conexión o credenciales de Firestore no configuradas',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean', example: false },
                    error: {
                      type: 'string',
                      example:
                        'Credenciales de Firebase Admin no configuradas en backend-api.',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};
