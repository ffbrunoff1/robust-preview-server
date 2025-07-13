import fs from 'fs/promises';
import path from 'path';
import { createContextLogger } from './logger.js';
import config from '../config/index.js';

const logger = createContextLogger('FileSystem');

// Criar diretório de forma segura
export const ensureDirectory = async (dirPath) => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    logger.debug(`Diretório criado/verificado: ${dirPath}`);
  } catch (error) {
    logger.error(`Erro ao criar diretório ${dirPath}:`, { error: error.message });
    throw new Error(`Falha ao criar diretório: ${error.message}`);
  }
};

// Escrever arquivo de forma segura
export const writeFileSecure = async (filePath, content) => {
  try {
    // Garantir que o diretório pai existe
    await ensureDirectory(path.dirname(filePath));
    
    // Converter conteúdo para string se necessário
    const fileContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    
    await fs.writeFile(filePath, fileContent, 'utf8');
    logger.debug(`Arquivo escrito: ${filePath}`);
  } catch (error) {
    logger.error(`Erro ao escrever arquivo ${filePath}:`, { error: error.message });
    throw new Error(`Falha ao escrever arquivo: ${error.message}`);
  }
};

// Verificar se um diretório existe
export const directoryExists = async (dirPath) => {
  try {
    const stats = await fs.stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
};

// Verificar se um arquivo existe
export const fileExists = async (filePath) => {
  try {
    const stats = await fs.stat(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
};

// Obter tamanho de um diretório
export const getDirectorySize = async (dirPath) => {
  try {
    let totalSize = 0;
    const files = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const file of files) {
      const filePath = path.join(dirPath, file.name);
      if (file.isDirectory()) {
        totalSize += await getDirectorySize(filePath);
      } else {
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
      }
    }
    
    return totalSize;
  } catch (error) {
    logger.error(`Erro ao calcular tamanho do diretório ${dirPath}:`, { error: error.message });
    return 0;
  }
};

// Remover diretório recursivamente
export const removeDirectory = async (dirPath) => {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
    logger.debug(`Diretório removido: ${dirPath}`);
  } catch (error) {
    logger.error(`Erro ao remover diretório ${dirPath}:`, { error: error.message });
    throw new Error(`Falha ao remover diretório: ${error.message}`);
  }
};

// Limpeza automática de previews antigos
export const cleanupOldPreviews = async () => {
  try {
    const previewsDir = config.previewsDir;
    
    if (!(await directoryExists(previewsDir))) {
      return;
    }
    
    const entries = await fs.readdir(previewsDir, { withFileTypes: true });
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const dirPath = path.join(previewsDir, entry.name);
        const stats = await fs.stat(dirPath);
        const ageMs = now - stats.mtimeMs;
        
        if (ageMs > config.previewMaxAgeMs) {
          await removeDirectory(dirPath);
          cleanedCount++;
          logger.info(`Preview antigo removido: ${entry.name}`, { ageHours: Math.round(ageMs / (1000 * 60 * 60)) });
        }
      }
    }
    
    if (cleanedCount > 0) {
      logger.info(`Limpeza concluída: ${cleanedCount} previews removidos`);
    }
  } catch (error) {
    logger.error('Erro durante limpeza automática:', { error: error.message });
  }
};

// Verificar espaço em disco disponível
export const checkDiskSpace = async () => {
  try {
    const stats = await fs.statfs(config.previewsDir);
    const freeBytes = stats.bavail * stats.bsize;
    const totalBytes = stats.blocks * stats.bsize;
    const usedBytes = totalBytes - freeBytes;
    const usagePercent = (usedBytes / totalBytes) * 100;
    
    return {
      free: freeBytes,
      total: totalBytes,
      used: usedBytes,
      usagePercent: Math.round(usagePercent * 100) / 100
    };
  } catch (error) {
    logger.error('Erro ao verificar espaço em disco:', { error: error.message });
    return null;
  }
};

export default {
  ensureDirectory,
  writeFileSecure,
  directoryExists,
  fileExists,
  getDirectorySize,
  removeDirectory,
  cleanupOldPreviews,
  checkDiskSpace
};

