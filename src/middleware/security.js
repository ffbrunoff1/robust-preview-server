import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createContextLogger } from '../utils/logger.js';
import config from '../config/index.js';

const logger = createContextLogger('Security');

// Rate limiting
export const createRateLimit = () => {
  return rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMaxRequests,
    message: {
      success: false,
      error: {
        message: 'Muitas requisições. Tente novamente mais tarde.',
        type: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(config.rateLimitWindowMs / 1000)
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn('Rate limit excedido:', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.url
      });
      
      res.status(429).json({
        success: false,
        error: {
          message: 'Muitas requisições. Tente novamente mais tarde.',
          type: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil(config.rateLimitWindowMs / 1000)
        }
      });
    }
  });
};

// Configuração do Helmet para segurança
export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
});

// Middleware para validar Content-Type
export const validateContentType = (req, res, next) => {
  if (req.method === 'POST' && req.path === '/build') {
    const contentType = req.get('Content-Type');
    
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Content-Type deve ser application/json',
          type: 'INVALID_CONTENT_TYPE'
        }
      });
    }
  }
  
  next();
};

// Middleware para sanitizar headers
export const sanitizeHeaders = (req, res, next) => {
  // Remover headers potencialmente perigosos
  delete req.headers['x-forwarded-host'];
  delete req.headers['x-forwarded-server'];
  
  next();
};

// Middleware para logging de segurança
export const securityLogger = (req, res, next) => {
  // Log de tentativas suspeitas
  const suspiciousPatterns = [
    /\.\./,  // Path traversal
    /<script/i,  // XSS
    /union.*select/i,  // SQL injection
    /javascript:/i,  // JavaScript injection
    /data:.*base64/i  // Data URI
  ];
  
  const url = req.url;
  const userAgent = req.get('User-Agent') || '';
  const body = JSON.stringify(req.body);
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(url) || pattern.test(userAgent) || pattern.test(body)) {
      logger.warn('Tentativa suspeita detectada:', {
        ip: req.ip,
        userAgent,
        url,
        pattern: pattern.toString(),
        body: req.body
      });
      break;
    }
  }
  
  next();
};

export default {
  createRateLimit,
  helmetConfig,
  validateContentType,
  sanitizeHeaders,
  securityLogger
};

