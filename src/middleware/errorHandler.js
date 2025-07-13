import { createContextLogger } from '../utils/logger.js';
import config from '../config/index.js';

const logger = createContextLogger('ErrorHandler');

// Classe para erros customizados
export class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Middleware de tratamento de erros
export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log do erro
  logger.error('Erro capturado:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    statusCode: error.statusCode
  });

  // Erro de validação Joi
  if (err.isJoi) {
    const message = err.details.map(detail => detail.message).join(', ');
    error = new AppError(`Erro de validação: ${message}`, 400);
  }

  // Erro de JSON malformado
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    error = new AppError('JSON malformado no corpo da requisição', 400);
  }

  // Erro de limite de tamanho
  if (err.code === 'LIMIT_FILE_SIZE') {
    error = new AppError('Arquivo muito grande', 413);
  }

  // Erro de ENOENT (arquivo não encontrado)
  if (err.code === 'ENOENT') {
    error = new AppError('Arquivo ou diretório não encontrado', 404);
  }

  // Erro de EACCES (permissão negada)
  if (err.code === 'EACCES') {
    error = new AppError('Permissão negada', 403);
  }

  // Erro de ENOSPC (sem espaço em disco)
  if (err.code === 'ENOSPC') {
    error = new AppError('Espaço em disco insuficiente', 507);
  }

  // Resposta de erro
  const response = {
    success: false,
    error: {
      message: error.message || 'Erro interno do servidor',
      timestamp: error.timestamp || new Date().toISOString(),
      requestId: req.id || 'unknown'
    }
  };

  // Incluir stack trace apenas em desenvolvimento
  if (config.nodeEnv === 'development') {
    response.error.stack = error.stack;
  }

  // Status code padrão
  const statusCode = error.statusCode || 500;

  res.status(statusCode).json(response);
};

// Middleware para capturar rotas não encontradas
export const notFoundHandler = (req, res, next) => {
  const error = new AppError(`Rota não encontrada: ${req.originalUrl}`, 404);
  next(error);
};

// Middleware para adicionar ID único à requisição
export const requestId = (req, res, next) => {
  req.id = Math.random().toString(36).substr(2, 9);
  res.setHeader('X-Request-ID', req.id);
  next();
};

export default {
  AppError,
  errorHandler,
  notFoundHandler,
  requestId
};

