const fs = require('fs');
const path = require('path');

//logs181125

const logsDir = path.resolve(__dirname, 'logs');

if (!fs.existsSync(logsDir)) {
  console.log('❌ Pasta de logs não encontrada');
  process.exit(1);
}

const files = fs.readdirSync(logsDir)
  .filter(file => file.startsWith('console-') && file.endsWith('.log'))
  .sort()
  .reverse();

if (files.length === 0) {
  console.log('❌ Nenhum arquivo de log encontrado');
  process.exit(1);
}

console.log('📋 Arquivos de log disponíveis:');
files.forEach((file, index) => {
  const filePath = path.join(logsDir, file);
  const stats = fs.statSync(filePath);
  const size = (stats.size / 1024).toFixed(2);
  console.log(`${index + 1}. ${file} (${size} KB)`);
});

const latestFile = files[0];
const latestPath = path.join(logsDir, latestFile);

console.log(`\n📄 Conteúdo do log mais recente (${latestFile}):`);
console.log('─'.repeat(60));

try {
  const content = fs.readFileSync(latestPath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim());
  
  // Mostra as últimas 20 linhas
  const lastLines = lines.slice(-20);
  lastLines.forEach(line => console.log(line));
  
  if (lines.length > 20) {
    console.log(`\n... e mais ${lines.length - 20} linhas anteriores`);
  }
} catch (error) {
  console.error('❌ Erro ao ler arquivo:', error.message);
}