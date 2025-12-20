import axios from "axios";
import * as Sentry from "@sentry/node";
import Ticket from "../../models/Ticket";
import TicketTraking from "../../models/TicketTraking";
import QueueIntegrations from "../../models/QueueIntegrations";

interface NotifyTicketBotParams {
  ticket: Ticket;
  ticketTraking: TicketTraking;
  skipRating?: boolean;
}

interface TicketBotPayload {
  ticketTrakingId: number;
  wa_id?: number;
  group_wa_jid?: string;
  skipRating?: boolean;
}

const NotifyTicketBotService = async ({
  ticket,
  ticketTraking,
  skipRating = false
}: NotifyTicketBotParams): Promise<void> => {
  try {
    // Buscar URL do webhook na tabela QueueIntegrations
    const queueIntegration = await QueueIntegrations.findOne({
      where: {
        companyId: ticket.companyId,
        type: 'webhook' // ou o tipo que identifica o TicketBot
      }
    });
    
    if (!queueIntegration?.urlN8N) {
      console.log("⚠️ URL do TicketBot não configurada na integração - Notificação não enviada");
      return;
    }

    const ticketBotWebhookUrl = queueIntegration.urlN8N;
    
    // Construir payload conforme especificação do TicketBot
    const payload: TicketBotPayload = {
      ticketTrakingId: ticketTraking.id,
      wa_id: ticket.whatsappId
    };

    // Adicionar skipRating se for rota administrativa
    if (skipRating) {
      payload.skipRating = true;
    }

    // Se for grupo, adicionar group_wa_jid
    if (ticket.isGroup && ticket.contact?.number) {
      payload.group_wa_jid = ticket.contact.number;
    }

    console.log(`📤 Enviando notificação para TicketBot - Ticket #${ticket.id}:`, payload);
    console.log(`🔗 URL: ${ticketBotWebhookUrl}`);

    // Enviar notificação para o TicketBot
    const response = await axios.post(ticketBotWebhookUrl, payload, {
      timeout: 10000, // 10 segundos de timeout
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'VipClub-Backend/1.0'
      }
    });

    console.log(`✅ TicketBot notificado com sucesso - Ticket #${ticket.id} - Status: ${response.status}`);

  } catch (error) {
    console.error(`❌ Erro ao notificar TicketBot - Ticket #${ticket.id}:`, error.message);
    
    // Capturar erro no Sentry mas não interromper o fluxo
    Sentry.captureException(error, {
      tags: {
        service: 'NotifyTicketBotService',
        ticketId: ticket.id,
        skipRating
      },
      extra: {
        ticketTrakingId: ticketTraking.id,
        whatsappId: ticket.whatsappId,
        isGroup: ticket.isGroup
      }
    });
  }
};

export default NotifyTicketBotService;