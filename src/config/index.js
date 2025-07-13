import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  // Servidor
  port: process.env.PORT || 3001,
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Diretórios
  rootDir: path.resolve(__dirname, '../..'),
  previewsDir: process.env.PREVIEWS_DIR || path.resolve(__dirname, '../../previews'),
  logsDir: process.env.LOGS_DIR || path.resolve(__dirname, '../../logs'),
  
  // Limites
  maxFileSize: process.env.MAX_FILE_SIZE || '50mb',
  maxFiles: parseInt(process.env.MAX_FILES) || 100,
  maxProjectSize: parseInt(process.env.MAX_PROJECT_SIZE) || 100 * 1024 * 1024, // 100MB
  
  // Rate limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10,
  
  // Limpeza automática
  cleanupIntervalMs: parseInt(process.env.CLEANUP_INTERVAL_MS) || 60 * 60 * 1000, // 1 hora
  previewMaxAgeMs: parseInt(process.env.PREVIEW_MAX_AGE_MS) || 24 * 60 * 60 * 1000, // 24 horas
  
  // Build
  buildTimeoutMs: parseInt(process.env.BUILD_TIMEOUT_MS) || 5 * 60 * 1000, // 5 minutos
  packageManager: process.env.PACKAGE_MANAGER || 'pnpm',
  
  // Segurança
  corsOrigin: process.env.CORS_ORIGIN || '*',
  trustProxy: process.env.TRUST_PROXY === 'true',
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  logFormat: process.env.LOG_FORMAT || 'combined'
};

export default config;

