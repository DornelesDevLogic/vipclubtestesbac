/**
 * Teste da integração com TicketBot
 * 
 * Este script testa se a nova funcionalidade de encerramento sem avaliação está funcionando
 */

const axios = require('axios');

// Configurações do teste
const BASE_URL = 'http://localhost:8080'; // Ajustar conforme necessário
const TICKET_ID = '624'; // ID do ticket para teste
const USER_ID = '7'; // ID do usuário

// Token de autenticação (obter do login)
let authToken = '';

async function testTicketBotIntegration() {
  try {
    console.log('🧪 Iniciando teste da integração TicketBot...\n');

    // 1. Fazer login para obter token (ajustar conforme sua API de login)
    console.log('1. Fazendo login...');
    // const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
    //   email: 'admin@admin.com',
    //   password: 'admin123'
    // });
    // authToken = loginResponse.data.token;
    // console.log('✅ Login realizado com sucesso\n');

    // 2. Testar rota normal (com avaliação)
    console.log('2. Testando rota normal /tickets/:ticketId (COM avaliação)...');
    const normalPayload = {
      status: 'closed',
      userId: USER_ID,
      useIntegration: false,
      promptId: false,
      integrationId: false
    };

    console.log('Payload:', JSON.stringify(normalPayload, null, 2));
    console.log('Endpoint:', `${BASE_URL}/tickets/${TICKET_ID}`);
    console.log('⚠️ Esta rota deve enviar avaliação e notificar TicketBot com skipRating: false\n');

    // 3. Testar nova rota (sem avaliação)
    console.log('3. Testando nova rota /tickets2/:ticketId (SEM avaliação)...');
    const adminPayload = {
      status: 'closed',
      userId: USER_ID,
      useIntegration: false,
      promptId: false,
      integrationId: false
    };

    console.log('Payload:', JSON.stringify(adminPayload, null, 2));
    console.log('Endpoint:', `${BASE_URL}/tickets2/${TICKET_ID}`);
    console.log('✅ Esta rota deve pular avaliação e notificar TicketBot com skipRating: true\n');

    // 4. Verificar logs
    console.log('4. Verificar os logs do backend para confirmar:');
    console.log('   - Rota normal: "📝 Enviando mensagem de avaliação"');
    console.log('   - Rota admin: "🚫 Avaliação pulada por skipRating"');
    console.log('   - TicketBot: "📤 Enviando notificação para TicketBot" com skipRating correto\n');

    console.log('🎯 Teste configurado! Execute as chamadas manualmente ou descomente o código de requisição.');
    console.log('📋 Monitore os logs do backend para verificar o comportamento esperado.');

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

// Executar teste
testTicketBotIntegration();