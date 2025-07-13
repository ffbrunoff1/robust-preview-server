import express from 'express';
import { nanoid } from 'nanoid';
import path from 'path';
import { createContextLogger } from '../utils/logger.js';
import { buildPayloadSchema, validateProjectStructure } from '../utils/validation.js';
import { writeFileSecure, ensureDirectory, getDirectorySize, checkDiskSpace, removeDirectory } from '../utils/fileSystem.js';
import { runBuild } from '../services/buildService.js';
import { AppError } from '../middleware/errorHandler.js';
import config from '../config/index.js';

const router = express.Router();
const logger = createContextLogger('BuildRoute');

router.post('/build', async (req, res, next) => {
  const startTime = Date.now();
  let projectId = null;
  let projectDir = null;

  try {
    logger.info('Nova requisição de build recebida', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.id
    });

    // Verificar espaço em disco
    const diskSpace = await checkDiskSpace();
    if (diskSpace && diskSpace.usagePercent > 90) {
      throw new AppError('Espaço em disco insuficiente', 507);
    }

    // Validar payload
    const { error, value } = buildPayloadSchema.validate(req.body);
    if (error) {
      throw new AppError(`Erro de validação: ${error.details[0].message}`, 400);
    }

    const { files } = value;

    // Validar estrutura do projeto
    validateProjectStructure(files);

    // Verificar número de arquivos
    const fileCount = Object.keys(files).length;
    if (fileCount > config.maxFiles) {
      throw new AppError(`Muitos arquivos: ${fileCount}. Máximo permitido: ${config.maxFiles}`, 400);
    }

    // Gerar ID único para o projeto
    projectId = nanoid();
    projectDir = path.join(config.previewsDir, projectId);

    logger.info('Iniciando criação do projeto', {
      projectId,
      fileCount,
      requestId: req.id
    });

    // Criar diretório do projeto
    await ensureDirectory(projectDir);

    // Escrever arquivos
    const writePromises = Object.entries(files).map(async ([filePath, content]) => {
      const fullPath = path.join(projectDir, filePath);
      await writeFileSecure(fullPath, content);
    });

    await Promise.all(writePromises);

    // Verificar tamanho do projeto
    const projectSize = await getDirectorySize(projectDir);
    if (projectSize > config.maxProjectSize) {
      throw new AppError(`Projeto muito grande: ${Math.round(projectSize / 1024 / 1024)}MB. Máximo: ${Math.round(config.maxProjectSize / 1024 / 1024)}MB`, 413);
    }

    logger.info('Arquivos escritos, iniciando build', {
      projectId,
      projectSize: Math.round(projectSize / 1024 / 1024),
      requestId: req.id
    });

    // Executar build
    const buildResult = await runBuild(projectDir, id);

    // Gerar URL de preview
    const previewUrl = `${req.protocol}://${req.get('host')}/preview/${projectId}/${buildResult.distDir}/`;

    const duration = Date.now() - startTime;

    logger.info('Build concluído com sucesso', {
      projectId,
      projectType: buildResult.projectType,
      distDir: buildResult.distDir,
      duration,
      previewUrl,
      requestId: req.id
    });

    res.json({
      success: true,
      data: {
        projectId,
        url: previewUrl,
        projectType: buildResult.projectType,
        buildTime: duration,
        fileCount,
        projectSize: Math.round(projectSize / 1024 / 1024)
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error('Erro durante build:', {
      projectId,
      error: error.message,
      duration,
      requestId: req.id
    });

    // Limpar diretório em caso de erro
    if (projectDir) {
      try {
        await removeDirectory(projectDir);
        logger.debug('Diretório de projeto removido após erro', { projectId });
      } catch (cleanupError) {
        logger.error('Erro ao limpar diretório após falha:', {
          projectId,
          error: cleanupError.message
        });
      }
    }

    next(error);
  }
});

export default router;

