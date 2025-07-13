# Guia de Deployment - Sistema de Preview Robusto

## Visão Geral

Este guia fornece instruções detalhadas para implantar o sistema de preview em diferentes ambientes de produção, incluindo Render.com, Heroku, DigitalOcean, AWS e deployment local.

## Render.com (Recomendado)

### Configuração Inicial

1. **Conectar Repositório**:
   - Acesse [render.com](https://render.com)
   - Clique em "New +" → "Web Service"
   - Conecte seu repositório GitHub/GitLab

2. **Configurações do Serviço**:
   ```
   Name: preview-server-robust
   Environment: Node
   Build Command: npm install
   Start Command: npm start
   ```

3. **Variáveis de Ambiente**:
   ```bash
   NODE_ENV=production
   PORT=10000
   HOST=0.0.0.0
   LOG_LEVEL=info
   PACKAGE_MANAGER=npm
   MAX_FILES=50
   MAX_PROJECT_SIZE=52428800
   BUILD_TIMEOUT_MS=300000
   CLEANUP_INTERVAL_MS=1800000
   PREVIEW_MAX_AGE_MS=43200000
   RATE_LIMIT_MAX_REQUESTS=20
   CORS_ORIGIN=*
   ```

4. **Configurações Avançadas**:
   - **Auto-Deploy**: Habilitado
   - **Health Check Path**: `/health`
   - **Instance Type**: Starter (512MB RAM)

### Otimizações para Render

```javascript
// src/config/render.js
export const renderConfig = {
  // Render usa porta dinâmica
  port: process.env.PORT || 10000,
  
  // Otimizações para ambiente Render
  buildTimeout: 240000, // 4 minutos (limite Render)
  maxProjectSize: 50 * 1024 * 1024, // 50MB
  cleanupInterval: 30 * 60 * 1000, // 30 minutos
  previewMaxAge: 12 * 60 * 60 * 1000, // 12 horas
  
  // Configurações de memória
  maxFiles: 50,
  rateLimitMax: 20
};
```

## Heroku

### Configuração

1. **Criar Aplicação**:
   ```bash
   heroku create preview-server-robust
   heroku config:set NODE_ENV=production
   heroku config:set PACKAGE_MANAGER=npm
   heroku config:set BUILD_TIMEOUT_MS=240000
   ```

2. **Procfile**:
   ```
   web: npm start
   ```

3. **Buildpacks**:
   ```bash
   heroku buildpacks:set heroku/nodejs
   ```

### Limitações do Heroku

- **Timeout**: 30 segundos para requests HTTP
- **Memória**: 512MB no plano gratuito
- **Armazenamento**: Efêmero (arquivos são perdidos)
- **Sleep**: Aplicação hiberna após 30 minutos

### Configurações Específicas

```javascript
// Configuração para Heroku
if (process.env.DYNO) {
  config.buildTimeout = 25000; // 25 segundos
  config.maxProjectSize = 25 * 1024 * 1024; // 25MB
  config.previewMaxAge = 30 * 60 * 1000; // 30 minutos
}
```

## DigitalOcean App Platform

### Configuração

1. **App Spec** (`.do/app.yaml`):
   ```yaml
   name: preview-server-robust
   services:
   - name: web
     source_dir: /
     github:
       repo: your-username/robust-preview-server
       branch: main
     run_command: npm start
     build_command: npm install
     environment_slug: node-js
     instance_count: 1
     instance_size_slug: basic-xxs
     envs:
     - key: NODE_ENV
       value: production
     - key: PACKAGE_MANAGER
       value: npm
     - key: BUILD_TIMEOUT_MS
       value: "300000"
     http_port: 8080
   ```

2. **Variáveis de Ambiente**:
   ```bash
   NODE_ENV=production
   PORT=8080
   HOST=0.0.0.0
   PACKAGE_MANAGER=npm
   ```

## AWS (EC2 + PM2)

### Configuração do Servidor

1. **Instalar Dependências**:
   ```bash
   # Atualizar sistema
   sudo apt update && sudo apt upgrade -y
   
   # Instalar Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Instalar PM2
   sudo npm install -g pm2
   ```

2. **Configuração PM2** (`ecosystem.config.js`):
   ```javascript
   module.exports = {
     apps: [{
       name: 'preview-server',
       script: 'src/server.js',
       instances: 'max',
       exec_mode: 'cluster',
       env: {
         NODE_ENV: 'development',
         PORT: 3001
       },
       env_production: {
         NODE_ENV: 'production',
         PORT: 3001,
         HOST: '0.0.0.0'
       },
       log_file: './logs/combined.log',
       error_file: './logs/error.log',
       out_file: './logs/out.log',
       max_memory_restart: '1G',
       node_args: '--max-old-space-size=1024'
     }]
   };
   ```

3. **Deploy**:
   ```bash
   # Clone projeto
   git clone <repository-url>
   cd robust-preview-server
   
   # Instalar dependências
   npm install --production
   
   # Iniciar com PM2
   pm2 start ecosystem.config.js --env production
   pm2 save
   pm2 startup
   ```

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

## Docker

### Dockerfile

```dockerfile
FROM node:18-alpine

# Instalar dependências do sistema
RUN apk add --no-cache \
    git \
    python3 \
    make \
    g++

# Criar usuário não-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm ci --only=production && npm cache clean --force

# Copiar código fonte
COPY --chown=nextjs:nodejs . .

# Criar diretórios necessários
RUN mkdir -p logs previews && chown -R nextjs:nodejs logs previews

# Mudar para usuário não-root
USER nextjs

# Expor porta
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Comando de inicialização
CMD ["npm", "start"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  preview-server:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - HOST=0.0.0.0
      - PORT=3001
      - PACKAGE_MANAGER=npm
    volumes:
      - ./logs:/app/logs
      - ./previews:/app/previews
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - preview-server
    restart: unless-stopped
```

## Kubernetes

### Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: preview-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: preview-server
  template:
    metadata:
      labels:
        app: preview-server
    spec:
      containers:
      - name: preview-server
        image: your-registry/preview-server:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        - name: HOST
          value: "0.0.0.0"
        - name: PORT
          value: "3001"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: preview-server-service
spec:
  selector:
    app: preview-server
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3001
  type: LoadBalancer
```

## Monitoramento em Produção

### Logs Centralizados

```javascript
// Configuração para logs em produção
if (config.nodeEnv === 'production') {
  // Adicionar transporte para serviços externos
  logger.add(new winston.transports.Http({
    host: 'logs.your-service.com',
    port: 443,
    path: '/logs',
    ssl: true
  }));
}
```

### Métricas

```javascript
// Middleware para métricas
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // Enviar métricas para serviço de monitoramento
    metrics.increment('requests.total');
    metrics.histogram('requests.duration', duration);
    metrics.gauge('memory.usage', process.memoryUsage().heapUsed);
  });
  
  next();
});
```

### Alertas

```javascript
// Sistema de alertas
const alerting = {
  diskSpaceThreshold: 90,
  memoryThreshold: 80,
  errorRateThreshold: 5,
  
  checkAndAlert() {
    // Verificar métricas e enviar alertas
    if (this.getDiskUsage() > this.diskSpaceThreshold) {
      this.sendAlert('Disk space critical');
    }
  }
};
```

## Backup e Recuperação

### Backup de Logs

```bash
#!/bin/bash
# backup-logs.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/logs"
LOG_DIR="/app/logs"

# Criar backup comprimido
tar -czf "$BACKUP_DIR/logs_$DATE.tar.gz" -C "$LOG_DIR" .

# Manter apenas últimos 30 dias
find "$BACKUP_DIR" -name "logs_*.tar.gz" -mtime +30 -delete
```

### Recuperação de Desastre

```bash
#!/bin/bash
# disaster-recovery.sh

# Parar serviço
pm2 stop preview-server

# Restaurar código
git pull origin main
npm install --production

# Restaurar configurações
cp /backups/config/.env .

# Reiniciar serviço
pm2 restart preview-server

# Verificar saúde
curl -f http://localhost:3001/health
```

## Otimizações de Performance

### Cache de Dependências

```javascript
// Cache inteligente de node_modules
const dependencyCache = new Map();

const getCachedDependencies = (packageJsonHash) => {
  if (dependencyCache.has(packageJsonHash)) {
    return dependencyCache.get(packageJsonHash);
  }
  return null;
};
```

### Build Paralelo

```javascript
// Pool de workers para builds paralelos
const buildQueue = new Queue('build', {
  concurrency: 3,
  timeout: 300000
});

buildQueue.process(async (job) => {
  const { projectId, files } = job.data;
  return await runBuild(projectId, files);
});
```

## Troubleshooting em Produção

### Logs de Debug

```bash
# Ver logs em tempo real
tail -f logs/combined.log | grep ERROR

# Analisar performance
grep "Build concluído" logs/combined.log | awk '{print $NF}' | sort -n

# Verificar rate limiting
grep "Rate limit" logs/combined.log | wc -l
```

### Comandos Úteis

```bash
# Verificar status do serviço
pm2 status

# Reiniciar sem downtime
pm2 reload preview-server

# Verificar uso de recursos
pm2 monit

# Logs em tempo real
pm2 logs preview-server --lines 100
```

## Segurança em Produção

### Firewall

```bash
# Configurar UFW
sudo ufw enable
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 3001/tcp  # Bloquear acesso direto
```

### SSL/TLS

```bash
# Certificado Let's Encrypt
sudo certbot --nginx -d your-domain.com
```

### Variáveis Sensíveis

```bash
# Usar secrets manager
export DATABASE_URL=$(aws secretsmanager get-secret-value --secret-id prod/db --query SecretString --output text)
```

---

Este guia fornece uma base sólida para deployment em diferentes ambientes. Adapte as configurações conforme suas necessidades específicas e requisitos de infraestrutura.

