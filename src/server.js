import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';

// Importações locais
import config from './config/index.js';
import logger, { createContextLogger } from './utils/logger.js';
import { ensureDirectory, cleanupOldPreviews } from './utils/fileSystem.js';
import { 
  errorHandler, 
  notFoundHandler, 
  requestId 
} from './middleware/errorHandler.js';
import { 
  createRateLimit, 
  helmetConfig, 
  validateContentType, 
  sanitizeHeaders, 
  securityLogger 
} from './middleware/security.js';

// Rotas
import healthRoutes from './routes/health.js';
import buildRoutes from './routes/build.js';

const serverLogger = createContextLogger('Server');

class PreviewServer {
  constructor() {
    this.app = express();
    this.server = null;
    this.cleanupInterval = null;
  }

  async initialize() {
    try {
      // Criar diretórios necessários
      await this.createDirectories();
      
      // Configurar middleware
      this.setupMiddleware();
      
      // Configurar rotas
      this.setupRoutes();
      
      // Configurar tratamento de erros
      this.setupErrorHandling();
      
      // Configurar limpeza automática
      this.setupCleanup();
      
      serverLogger.info('Servidor inicializado com sucesso');
    } catch (error) {
      serverLogger.error('Erro durante inicialização:', { error: error.message });
      throw error;
    }
  }

  async createDirectories() {
    const directories = [
      config.previewsDir,
      config.logsDir
    ];

    for (const dir of directories) {
      await ensureDirectory(dir);
      serverLogger.debug(`Diretório verificado: ${dir}`);
    }
  }

  setupMiddleware() {
    // Trust proxy se configurado
    if (config.trustProxy) {
      this.app.set('trust proxy', 1);
    }

    // Request ID
    this.app.use(requestId);

    // Segurança
    this.app.use(helmetConfig);
    this.app.use(sanitizeHeaders);
    this.app.use(securityLogger);

    // CORS
    this.app.use(cors({
      origin: config.corsOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
    }));

    // Rate limiting
    this.app.use(createRateLimit());

    // Body parsing
    this.app.use(express.json({ 
      limit: config.maxFileSize,
      strict: true
    }));

    // Validação de Content-Type
    this.app.use(validateContentType);

    // Logging de requisições
    this.app.use((req, res, next) => {
      serverLogger.info('Requisição recebida', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        requestId: req.id
      });
      next();
    });
  }

  setupRoutes() {
    // Rotas de health
    this.app.use('/', healthRoutes);
    
    // Rotas de build
    this.app.use('/', buildRoutes);

    // Servir arquivos estáticos de preview
    this.app.use('/preview', express.static(config.previewsDir, {
      maxAge: '1h',
      etag: true,
      lastModified: true,
      setHeaders: (res, path) => {
        // Configurar headers para diferentes tipos de arquivo
        if (path.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        } else if (path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2)$/)) {
          res.setHeader('Cache-Control', 'public, max-age=3600');
        }
      }
    }));
  }

  setupErrorHandling() {
    // 404 handler
    this.app.use(notFoundHandler);
    
    // Error handler
    this.app.use(errorHandler);

    // Uncaught exception handler
    process.on('uncaughtException', (error) => {
      serverLogger.error('Uncaught Exception:', { error: error.message, stack: error.stack });
      this.gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    // Unhandled rejection handler
    process.on('unhandledRejection', (reason, promise) => {
      serverLogger.error('Unhandled Rejection:', { reason, promise });
      this.gracefulShutdown('UNHANDLED_REJECTION');
    });

    // Graceful shutdown signals
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
  }

  setupCleanup() {
    // Limpeza inicial
    cleanupOldPreviews().catch(error => {
      serverLogger.error('Erro na limpeza inicial:', { error: error.message });
    });

    // Limpeza periódica
    this.cleanupInterval = setInterval(() => {
      cleanupOldPreviews().catch(error => {
        serverLogger.error('Erro na limpeza periódica:', { error: error.message });
      });
    }, config.cleanupIntervalMs);

    serverLogger.info('Limpeza automática configurada', {
      intervalMinutes: config.cleanupIntervalMs / (1000 * 60),
      maxAgeHours: config.previewMaxAgeMs / (1000 * 60 * 60)
    });
  }

  async start() {
    try {
      await this.initialize();

      this.server = this.app.listen(config.port, config.host, () => {
        serverLogger.info('🚀 Servidor iniciado', {
          port: config.port,
          host: config.host,
          nodeEnv: config.nodeEnv,
          packageManager: config.packageManager
        });
      });

      return this.server;
    } catch (error) {
      serverLogger.error('Erro ao iniciar servidor:', { error: error.message });
      throw error;
    }
  }

  async gracefulShutdown(signal) {
    serverLogger.info(`Recebido sinal ${signal}, iniciando shutdown graceful...`);

    // Parar de aceitar novas conexões
    if (this.server) {
      this.server.close(() => {
        serverLogger.info('Servidor HTTP fechado');
      });
    }

    // Limpar interval de limpeza
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      serverLogger.info('Limpeza automática interrompida');
    }

    // Aguardar um pouco para requisições em andamento
    setTimeout(() => {
      serverLogger.info('Shutdown concluído');
      process.exit(0);
    }, 5000);
  }
}

// Inicializar e executar servidor
const server = new PreviewServer();

if (import.meta.url === `file://${process.argv[1]}`) {
  server.start().catch(error => {
    logger.error('Falha ao iniciar servidor:', { error: error.message });
    process.exit(1);
  });
}

export default PreviewServer;

