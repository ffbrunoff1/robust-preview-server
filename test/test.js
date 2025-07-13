import http from 'http';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuração de teste
const TEST_CONFIG = {
  host: 'localhost',
  port: 3001,
  timeout: 30000
};

// Utilitário para fazer requisições HTTP
const makeRequest = (options, data = null) => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const response = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: res.headers['content-type']?.includes('application/json') 
              ? JSON.parse(body) 
              : body
          };
          resolve(response);
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body
          });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(TEST_CONFIG.timeout, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
};

// Testes
const tests = [];

// Teste 1: Health check
tests.push({
  name: 'Health Check',
  async run() {
    const response = await makeRequest({
      hostname: TEST_CONFIG.host,
      port: TEST_CONFIG.port,
      path: '/',
      method: 'GET'
    });

    if (response.statusCode !== 200) {
      throw new Error(`Expected status 200, got ${response.statusCode}`);
    }

    if (!response.body.success) {
      throw new Error('Health check failed');
    }

    console.log('✅ Health check passed');
  }
});

// Teste 2: Health check detalhado
tests.push({
  name: 'Detailed Health Check',
  async run() {
    const response = await makeRequest({
      hostname: TEST_CONFIG.host,
      port: TEST_CONFIG.port,
      path: '/health',
      method: 'GET'
    });

    if (response.statusCode !== 200) {
      throw new Error(`Expected status 200, got ${response.statusCode}`);
    }

    if (!response.body.success) {
      throw new Error('Detailed health check failed');
    }

    console.log('✅ Detailed health check passed');
    console.log(`   Status: ${response.body.status}`);
    console.log(`   Response time: ${response.body.responseTime}ms`);
  }
});

// Teste 3: Validação de payload inválido
tests.push({
  name: 'Invalid Payload Validation',
  async run() {
    const response = await makeRequest({
      hostname: TEST_CONFIG.host,
      port: TEST_CONFIG.port,
      path: '/build',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, {
      invalid: 'payload'
    });

    if (response.statusCode !== 400) {
      throw new Error(`Expected status 400, got ${response.statusCode}`);
    }

    if (response.body.success !== false) {
      throw new Error('Expected validation error');
    }

    console.log('✅ Invalid payload validation passed');
  }
});

// Teste 4: Build de projeto React simples
tests.push({
  name: 'Simple React Project Build',
  async run() {
    const projectFiles = {
      'package.json': {
        "name": "test-react-app",
        "version": "1.0.0",
        "type": "module",
        "scripts": {
          "build": "vite build"
        },
        "dependencies": {
          "react": "^18.2.0",
          "react-dom": "^18.2.0"
        },
        "devDependencies": {
          "@vitejs/plugin-react": "^4.0.0",
          "vite": "^4.3.0"
        }
      },
      'vite.config.js': `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist'
  }
})`,
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Test React App</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>`,
      'src/main.jsx': `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`,
      'src/App.jsx': `import React from 'react'

function App() {
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>Test React App</h1>
      <p>This is a test React application for the preview server.</p>
    </div>
  )
}

export default App`
    };

    const response = await makeRequest({
      hostname: TEST_CONFIG.host,
      port: TEST_CONFIG.port,
      path: '/build',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, {
      files: projectFiles
    });

    if (response.statusCode !== 200) {
      console.error('Build response:', response.body);
      throw new Error(`Expected status 200, got ${response.statusCode}`);
    }

    if (!response.body.success) {
      throw new Error('Build failed');
    }

    if (!response.body.data.url) {
      throw new Error('No preview URL returned');
    }

    console.log('✅ React project build passed');
    console.log(`   Preview URL: ${response.body.data.url}`);
    console.log(`   Build time: ${response.body.data.buildTime}ms`);
    console.log(`   Project type: ${response.body.data.projectType}`);
  }
});

// Executar testes
async function runTests() {
  console.log('🧪 Iniciando testes do servidor...\n');

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      console.log(`🔄 Executando: ${test.name}`);
      await test.run();
      passed++;
    } catch (error) {
      console.error(`❌ Falhou: ${test.name}`);
      console.error(`   Erro: ${error.message}`);
      failed++;
    }
    console.log('');
  }

  console.log('📊 Resultados dos testes:');
  console.log(`   ✅ Passou: ${passed}`);
  console.log(`   ❌ Falhou: ${failed}`);
  console.log(`   📈 Total: ${passed + failed}`);

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('\n🎉 Todos os testes passaram!');
  }
}

// Verificar se o servidor está rodando
async function checkServer() {
  try {
    await makeRequest({
      hostname: TEST_CONFIG.host,
      port: TEST_CONFIG.port,
      path: '/',
      method: 'GET'
    });
    return true;
  } catch (error) {
    return false;
  }
}

// Executar
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🔍 Verificando se o servidor está rodando...');
  
  const isRunning = await checkServer();
  
  if (!isRunning) {
    console.error('❌ Servidor não está rodando. Inicie o servidor primeiro com: npm start');
    process.exit(1);
  }
  
  console.log('✅ Servidor está rodando\n');
  await runTests();
}

