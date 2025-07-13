import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { createContextLogger } from '../utils/logger.js';
import { fileExists, directoryExists } from '../utils/fileSystem.js';
import config from '../config/index.js';

const logger = createContextLogger('BuildService');

// Executar comando com timeout e logging detalhado
const runCommand = (cmd, args, projectDir, timeoutMs = config.buildTimeoutMs) => {
  return new Promise((resolve, reject) => {
    logger.info(`Executando comando: ${cmd} ${args.join(' ')}`, { projectDir });
    
    const child = spawn(cmd, args, { 
      cwd: projectDir, 
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let isTimedOut = false;

    // Timeout
    const timeout = setTimeout(() => {
      isTimedOut = true;
      child.kill('SIGKILL');
      reject(new Error(`Comando expirou após ${timeoutMs}ms: ${cmd} ${args.join(' ')}`));
    }, timeoutMs);

    // Capturar saídas
    child.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      logger.debug(`STDOUT: ${output.trim()}`, { cmd, projectDir });
    });

    child.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      logger.debug(`STDERR: ${output.trim()}`, { cmd, projectDir });
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      
      if (isTimedOut) return; // Já foi rejeitado pelo timeout
      
      if (code !== 0) {
        logger.error(`Comando falhou com código ${code}:`, { 
          cmd, 
          args, 
          projectDir, 
          stdout: stdout.trim(), 
          stderr: stderr.trim() 
        });
        reject(new Error(`Comando falhou (código ${code}): ${stderr.trim() || stdout.trim()}`));
      } else {
        logger.info(`Comando executado com sucesso: ${cmd}`, { projectDir });
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      }
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      logger.error(`Erro ao executar comando:`, { cmd, args, projectDir, error: error.message });
      reject(new Error(`Erro ao executar comando: ${error.message}`));
    });
  });
};

// Detectar tipo de projeto
export const detectProjectType = async (projectDir) => {
  const packageJsonPath = path.join(projectDir, 'package.json');
  
  if (await fileExists(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      
      // Verificar dependências para determinar o tipo
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      if (deps.astro) return 'astro';
      if (deps.vite || deps['@vitejs/plugin-react']) return 'vite';
      if (deps.react) return 'react';
      if (deps.vue) return 'vue';
      if (deps.svelte) return 'svelte';
      
      return 'generic';
    } catch (error) {
      logger.warn('Erro ao ler package.json:', { error: error.message, projectDir });
    }
  }
  
  // Verificar arquivos de configuração específicos
  if (await fileExists(path.join(projectDir, 'astro.config.mjs')) || 
      await fileExists(path.join(projectDir, 'astro.config.js'))) {
    return 'astro';
  }
  
  if (await fileExists(path.join(projectDir, 'vite.config.js')) || 
      await fileExists(path.join(projectDir, 'vite.config.ts'))) {
    return 'vite';
  }
  
  return 'generic';
};

// Verificar se as ferramentas necessárias estão disponíveis
export const checkBuildTools = async () => {
  const tools = ['node', 'npm'];
  
  if (config.packageManager === 'pnpm') {
    tools.push('pnpm');
  } else if (config.packageManager === 'yarn') {
    tools.push('yarn');
  }
  
  for (const tool of tools) {
    try {
      await runCommand('which', [tool], process.cwd(), 5000);
      logger.debug(`Ferramenta encontrada: ${tool}`);
    } catch (error) {
      throw new Error(`Ferramenta necessária não encontrada: ${tool}`);
    }
  }
  
  return true;
};

// Instalar dependências
export const installDependencies = async (projectDir) => {
  logger.info('Instalando dependências...', { projectDir });
  
  try {
    // Usar npm como fallback se pnpm falhar
    let installCmd = config.packageManager;
    let installArgs = config.packageManager === 'npm' ? ['install', '--silent'] : ['install'];
    
    try {
      // Tentar com o package manager configurado
      if (config.packageManager === 'pnpm') {
        // Verificar se pnpm está disponível
        await runCommand('which', ['pnpm'], projectDir, 5000);
        await runCommand(installCmd, installArgs, projectDir);
      } else {
        await runCommand(installCmd, installArgs, projectDir);
      }
    } catch (error) {
      // Fallback para npm se pnpm falhar
      if (config.packageManager === 'pnpm') {
        logger.warn('pnpm falhou, tentando com npm...', { error: error.message, projectDir });
        installCmd = 'npm';
        installArgs = ['install', '--silent'];
        await runCommand(installCmd, installArgs, projectDir);
      } else {
        throw error;
      }
    }
    
    logger.info('Dependências instaladas com sucesso', { projectDir });
  } catch (error) {
    logger.error('Erro ao instalar dependências:', { error: error.message, projectDir });
    throw new Error(`Falha na instalação de dependências: ${error.message}`);
  }
};

// Executar build
export const runBuild = async (projectDir) => {
  logger.info('Iniciando processo de build...', { projectDir });
  
  try {
    const projectType = await detectProjectType(projectDir);
    logger.info(`Tipo de projeto detectado: ${projectType}`, { projectDir });
    
    // Verificar ferramentas básicas
    await runCommand('which', ['node'], projectDir, 5000);
    await runCommand('which', ['npm'], projectDir, 5000);
    
    // Instalar dependências
    await installDependencies(projectDir);
    
    // Executar build - usar npm como padrão para maior compatibilidade
    let buildCmd = 'npm';
    const buildArgs = ['run', 'build'];
    
    await runCommand(buildCmd, buildArgs, projectDir);
    
    // Verificar se o build foi criado
    const possibleDistDirs = ['dist', 'build', 'out', '.next'];
    let distDir = null;
    
    for (const dir of possibleDistDirs) {
      const fullPath = path.join(projectDir, dir);
      if (await directoryExists(fullPath)) {
        distDir = dir;
        break;
      }
    }
    
    if (!distDir) {
      throw new Error('Diretório de build não encontrado. Verifique se o script de build está configurado corretamente.');
    }
    
    logger.info(`Build concluído com sucesso. Diretório: ${distDir}`, { projectDir });
    return { projectType, distDir };
    
  } catch (error) {
    logger.error('Erro durante o processo de build:', { error: error.message, projectDir });
    throw error;
  }
};

export default {
  detectProjectType,
  checkBuildTools,
  installDependencies,
  runBuild
};

