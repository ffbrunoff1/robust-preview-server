# Sistema Robusto de Preview para Projetos React/Vite/Tailwind/Astro

## Visão Geral

Este sistema foi desenvolvido para resolver os problemas identificados no código Express.js original, fornecendo uma solução robusta, segura e escalável para gerar URLs de preview de projetos front-end. O sistema suporta múltiplos frameworks incluindo React, Vite, Astro, Vue e Svelte.

## Principais Melhorias Implementadas

### 1. Arquitetura Modular
- **Separação de responsabilidades**: Código organizado em módulos específicos (config, middleware, routes, services, utils)
- **Configuração externalizável**: Todas as configurações podem ser definidas via variáveis de ambiente
- **Logging estruturado**: Sistema de logging robusto com diferentes níveis e destinos

### 2. Segurança Aprimorada
- **Validação rigorosa de entrada**: Uso do Joi para validação de schemas
- **Proteção contra path traversal**: Sanitização de caminhos de arquivo
- **Rate limiting**: Proteção contra abuso de API
- **Headers de segurança**: Implementação do Helmet para headers HTTP seguros
- **Sanitização de entrada**: Limpeza automática de dados de entrada

### 3. Tratamento de Erros Robusto
- **Middleware de erro centralizado**: Captura e tratamento consistente de erros
- **Logging detalhado**: Rastreamento completo de erros com contexto
- **Respostas padronizadas**: Formato consistente de resposta de erro
- **Graceful shutdown**: Encerramento elegante do servidor

### 4. Funcionalidades Avançadas
- **Limpeza automática**: Remoção periódica de previews antigos
- **Monitoramento de recursos**: Verificação de espaço em disco e memória
- **Health checks**: Endpoints para verificação de saúde do sistema
- **Fallback inteligente**: Uso de npm como fallback quando pnpm falha
- **Detecção automática de projeto**: Identificação do tipo de framework

## Estrutura do Projeto

```
robust-preview-server/
├── src/
│   ├── config/
│   │   └── index.js          # Configurações centralizadas
│   ├── middleware/
│   │   ├── errorHandler.js   # Tratamento de erros
│   │   └── security.js       # Middleware de segurança
│   ├── routes/
│   │   ├── build.js          # Rota de build
│   │   └── health.js         # Health checks
│   ├── services/
│   │   └── buildService.js   # Lógica de build
│   ├── utils/
│   │   ├── fileSystem.js     # Utilitários de arquivo
│   │   ├── logger.js         # Sistema de logging
│   │   └── validation.js     # Validações
│   └── server.js             # Servidor principal
├── test/
│   └── test.js               # Testes automatizados
├── logs/                     # Diretório de logs
├── previews/                 # Diretório de previews
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

## Instalação e Configuração

### Pré-requisitos
- Node.js 18+ 
- npm ou pnpm
- Git (opcional)

### Instalação

1. **Clone ou baixe o projeto**:
```bash
git clone <repository-url>
cd robust-preview-server
```

2. **Instale as dependências**:
```bash
npm install
```

3. **Configure as variáveis de ambiente** (opcional):
```bash
cp .env.example .env
# Edite o arquivo .env conforme necessário
```

4. **Inicie o servidor**:
```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```

## Configuração

O sistema pode ser configurado através de variáveis de ambiente. Consulte o arquivo `.env.example` para todas as opções disponíveis.

### Principais Configurações

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `PORT` | 3001 | Porta do servidor |
| `HOST` | 0.0.0.0 | Host do servidor |
| `NODE_ENV` | development | Ambiente de execução |
| `MAX_FILES` | 100 | Máximo de arquivos por projeto |
| `MAX_PROJECT_SIZE` | 104857600 | Tamanho máximo do projeto (bytes) |
| `BUILD_TIMEOUT_MS` | 300000 | Timeout para build (ms) |
| `PACKAGE_MANAGER` | pnpm | Gerenciador de pacotes preferido |

## API Endpoints

### GET /
Health check básico do servidor.

**Resposta**:
```json
{
  "success": true,
  "message": "🚀 Servidor de preview React/Vite funcionando corretamente.",
  "timestamp": "2025-07-13T01:00:00.000Z",
  "version": "1.0.0"
}
```

### GET /health
Health check detalhado com informações do sistema.

**Resposta**:
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2025-07-13T01:00:00.000Z",
  "responseTime": 25,
  "checks": {
    "directories": { "previews": true, "logs": true },
    "diskSpace": { "free": 34012786688, "usagePercent": 18.66 },
    "buildTools": { "available": true },
    "memory": { "rss": 70, "heapTotal": 13, "heapUsed": 11 },
    "uptime": { "process": 3600, "system": 134582 }
  }
}
```

### GET /stats
Estatísticas do servidor e previews.

### POST /build
Cria um preview do projeto.

**Payload**:
```json
{
  "files": {
    "package.json": { "name": "my-app", "scripts": { "build": "vite build" } },
    "src/App.jsx": "import React from 'react'...",
    "index.html": "<!DOCTYPE html>..."
  }
}
```

**Resposta de Sucesso**:
```json
{
  "success": true,
  "data": {
    "projectId": "abc123",
    "url": "https://your-domain.com/preview/abc123/dist/",
    "projectType": "vite",
    "buildTime": 45000,
    "fileCount": 15,
    "projectSize": 2
  }
}
```

### GET /preview/:id/:path*
Serve os arquivos estáticos do preview gerado.

## Uso

### Exemplo Básico

```javascript
const response = await fetch('http://localhost:3001/build', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    files: {
      'package.json': {
        name: 'test-app',
        scripts: { build: 'vite build' },
        dependencies: { react: '^18.0.0' },
        devDependencies: { vite: '^4.0.0' }
      },
      'index.html': '<!DOCTYPE html><html>...</html>',
      'src/main.jsx': 'import React from "react"...'
    }
  })
});

const result = await response.json();
console.log('Preview URL:', result.data.url);
```

### Frameworks Suportados

- **React**: Projetos com Vite ou Create React App
- **Vue**: Projetos Vue 3 com Vite
- **Svelte**: Projetos SvelteKit
- **Astro**: Projetos Astro
- **Vanilla**: Projetos HTML/CSS/JS simples

## Monitoramento e Logs

### Sistema de Logging

O sistema utiliza Winston para logging estruturado:

- **Console**: Logs coloridos em desenvolvimento
- **Arquivos**: Logs em produção (`logs/combined.log`, `logs/error.log`)
- **Níveis**: error, warn, info, debug

### Health Monitoring

- **Espaço em disco**: Monitoramento automático
- **Memória**: Uso de heap e RSS
- **Uptime**: Tempo de execução do processo e sistema
- **Ferramentas de build**: Verificação de disponibilidade

## Segurança

### Medidas Implementadas

1. **Validação de entrada**: Schema validation com Joi
2. **Path traversal protection**: Sanitização de caminhos
3. **Rate limiting**: 10 requests por 15 minutos por IP
4. **Headers de segurança**: Helmet.js configurado
5. **Content-Type validation**: Verificação de tipos MIME
6. **Sanitização**: Limpeza automática de dados

### Limitações de Segurança

- Execução de código arbitrário durante build
- Dependência de ferramentas externas (npm, node)
- Armazenamento temporário de arquivos

## Performance

### Otimizações

- **Limpeza automática**: Remoção de previews antigos (24h por padrão)
- **Timeout de build**: Limite de 5 minutos por build
- **Limite de tamanho**: Máximo 100MB por projeto
- **Cache de arquivos estáticos**: Headers de cache configurados

### Métricas

- **Build time**: Tempo médio de 30-60 segundos
- **Memory usage**: ~70MB RSS em idle
- **Disk usage**: Limpeza automática mantém uso controlado

## Troubleshooting

### Problemas Comuns

1. **Build falha com pnpm**:
   - Sistema automaticamente tenta npm como fallback
   - Verifique logs para detalhes específicos

2. **Espaço em disco insuficiente**:
   - Servidor retorna erro 507
   - Configure limpeza mais frequente

3. **Timeout de build**:
   - Aumente `BUILD_TIMEOUT_MS`
   - Otimize dependências do projeto

4. **Rate limit excedido**:
   - Aguarde 15 minutos ou configure limites maiores
   - Use IPs diferentes se necessário

### Logs de Debug

```bash
# Ver logs em tempo real
tail -f logs/combined.log

# Filtrar apenas erros
grep "error" logs/combined.log

# Logs de build específico
grep "projectId" logs/combined.log
```

## Deployment

### Render.com

1. Conecte seu repositório
2. Configure as variáveis de ambiente
3. Use o comando de build: `npm install`
4. Use o comando de start: `npm start`

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

### Variáveis de Ambiente para Produção

```bash
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
LOG_LEVEL=info
CLEANUP_INTERVAL_MS=3600000
PREVIEW_MAX_AGE_MS=86400000
```

## Testes

Execute os testes automatizados:

```bash
# Inicie o servidor
npm start

# Em outro terminal, execute os testes
npm test
```

Os testes verificam:
- Health checks básico e detalhado
- Validação de payload
- Build de projeto React completo
- Geração de URL de preview

## Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## Licença

MIT License - veja o arquivo LICENSE para detalhes.

## Suporte

Para suporte e dúvidas:
- Abra uma issue no repositório
- Consulte os logs para debugging
- Verifique a documentação da API

---

**Desenvolvido por Manus AI** - Sistema robusto de preview para projetos front-end modernos.

