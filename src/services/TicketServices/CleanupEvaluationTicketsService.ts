import { Op } from "sequelize";
import Ticket from "../../models/Ticket";
import { logger } from "../../utils/logger";

const CleanupEvaluationTicketsService = async (): Promise<void> => {
  try {
    // Buscar tickets pendentes com avaliação como última mensagem
    const ticketsToClose = await Ticket.findAll({
      where: {
        status: "pending",
        lastMessage: {
          [Op.like]: "⭐📝%"
        }
      }
    });

    if (ticketsToClose.length > 0) {
      console.log(`🧹 Encontrados ${ticketsToClose.length} tickets pendentes com avaliação - Fechando automaticamente`);
      
      // Fechar todos os tickets encontrados
      await Ticket.update(
        { 
          status: "closed",
          userId: null,
          queueId: null
        },
        {
          where: {
            id: {
              [Op.in]: ticketsToClose.map(t => t.id)
            }
          }
        }
      );

      console.log(`✅ ${ticketsToClose.length} tickets fechados automaticamente`);
      
      // Log individual para debug
      ticketsToClose.forEach(ticket => {
        console.log(`🔒 Ticket #${ticket.id} fechado - Contato: ${ticket.contactId}`);
      });
    }
  } catch (error) {
    logger.error(`Erro na limpeza de tickets com avaliação: ${error}`);
  }
};

export default CleanupEvaluationTicketsService;