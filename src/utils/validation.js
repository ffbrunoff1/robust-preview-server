import Joi from 'joi';
import path from 'path';
import sanitizeFilename from 'sanitize-filename';

// Schema para validação do payload de build
export const buildPayloadSchema = Joi.object({
  files: Joi.object().pattern(
    Joi.string().custom((value, helpers) => {
      // Validação de path seguro
      if (value.includes('..') || path.isAbsolute(value)) {
        return helpers.error('any.invalid');
      }
      
      // Permitir paths com barras (diretórios)
      const normalizedPath = path.normalize(value);
      if (normalizedPath !== value && !value.includes('/')) {
        return helpers.error('any.invalid');
      }
      
      return value;
    }, 'safe file path'),
    Joi.alternatives().try(
      Joi.string().max(1024 * 1024), // 1MB por arquivo de texto
      Joi.object()
    )
  ).min(1).max(100).required() // Mínimo 1 arquivo, máximo 100
}).required();

// Validação de tipos de arquivo permitidos
const allowedExtensions = [
  '.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css', '.scss', '.sass',
  '.vue', '.svelte', '.astro', '.md', '.mdx', '.txt', '.env', '.gitignore',
  '.yml', '.yaml', '.toml', '.xml', '.svg', '.ico', '.png', '.jpg', '.jpeg',
  '.gif', '.webp', '.woff', '.woff2', '.ttf', '.eot'
];

export const validateFileExtension = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  return allowedExtensions.includes(ext) || ext === '';
};

// Validação de estrutura de projeto
export const validateProjectStructure = (files) => {
  const fileKeys = Object.keys(files);
  
  // Deve ter pelo menos um arquivo de configuração principal
  const hasMainConfig = fileKeys.some(file => 
    ['package.json', 'vite.config.js', 'vite.config.ts', 'astro.config.mjs', 'astro.config.js'].includes(file)
  );
  
  if (!hasMainConfig) {
    throw new Error('Projeto deve conter pelo menos um arquivo de configuração principal (package.json, vite.config.js, etc.)');
  }
  
  // Verificar se todos os arquivos têm extensões válidas
  for (const filePath of fileKeys) {
    if (!validateFileExtension(filePath)) {
      throw new Error(`Extensão de arquivo não permitida: ${path.extname(filePath)}`);
    }
  }
  
  return true;
};

// Sanitização de entrada
export const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return input.trim();
  }
  return input;
};

export default {
  buildPayloadSchema,
  validateFileExtension,
  validateProjectStructure,
  sanitizeInput
};

