// Importa o sistema de logs
require('./dist/utils/dailyLogger');

// Testa diferentes tipos de logs
console.log('Teste de log normal');
console.error('Teste de erro');
console.warn('Teste de aviso');
console.log('Objeto:', { teste: 'valor', numero: 123 });

console.log('✅ Logs salvos em: backend/logs/console-YYYY-MM-DD.log');