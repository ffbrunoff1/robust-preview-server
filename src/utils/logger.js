import winston from 'winston';
import path from 'path';
import config from '../config/index.js';

const { combine, timestamp, errors, json, printf, colorize } = winston.format;

// Formato personalizado para desenvolvimento
const devFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

// Configuração dos transportes
const transports = [
  // Console (sempre ativo)
  new winston.transports.Console({
    format: combine(
      colorize(),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      errors({ stack: true }),
      config.nodeEnv === 'development' ? devFormat : json()
    )
  })
];

// Arquivo de log em produção
if (config.nodeEnv === 'production') {
  transports.push(
    new winston.transports.File({
      filename: path.join(config.logsDir, 'error.log'),
      level: 'error',
      format: combine(timestamp(), errors({ stack: true }), json())
    }),
    new winston.transports.File({
      filename: path.join(config.logsDir, 'combined.log'),
      format: combine(timestamp(), errors({ stack: true }), json())
    })
  );
}

// Criação do logger
const logger = winston.createLogger({
  level: config.logLevel,
  format: combine(
    timestamp(),
    errors({ stack: true }),
    json()
  ),
  transports,
  // Não sair do processo em caso de erro
  exitOnError: false
});

// Função para criar logs contextuais
export const createContextLogger = (context) => {
  return {
    info: (message, meta = {}) => logger.info(message, { context, ...meta }),
    warn: (message, meta = {}) => logger.warn(message, { context, ...meta }),
    error: (message, meta = {}) => logger.error(message, { context, ...meta }),
    debug: (message, meta = {}) => logger.debug(message, { context, ...meta })
  };
};

export default logger;

