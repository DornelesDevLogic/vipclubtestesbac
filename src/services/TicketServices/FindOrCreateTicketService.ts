import { subHours } from "date-fns";
import { Op } from "sequelize";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import ShowTicketService from "./ShowTicketService";
import FindOrCreateATicketTrakingService from "./FindOrCreateATicketTrakingService";
import Setting from "../../models/Setting";
import Whatsapp from "../../models/Whatsapp";

interface TicketData {
  status?: string;
  companyId?: number;
  unreadMessages?: number;
}

interface MessageInfo {
  body?: string;
  fromMe?: boolean;
}

const FindOrCreateTicketService = async (
  contact: Contact,
  whatsappId: number,
  unreadMessages: number,
  companyId: number,
  groupContact?: Contact,
  openTicketSchedule?: boolean,
  messageInfo?: MessageInfo
): Promise<Ticket> => {
  let ticket;
  // Buscar ticket existente APENAS na conexão atual
  ticket = await Ticket.findOne({
    where: {
      status: {
        [Op.or]: ["open", "pending", "closed"]
      },
      contactId: groupContact ? groupContact.id : contact.id,
      companyId,
      whatsappId
    },
    order: [["id", "DESC"]]
  });
  
  console.log(`🔍 Buscando ticket para contato ${contact.number} na conexão ${whatsappId}: ${ticket ? `#${ticket.id} (${ticket.status})` : 'Não encontrado'}`);

    if (ticket) {
      console.log(`🔍 Ticket encontrado: #${ticket.id} - Status: ${ticket.status}, UserId: ${ticket.userId}, QueueId: ${ticket.queueId}`);
      
      if (openTicketSchedule) {
        await ticket.update({ status: "open", unreadMessages });
      } else {
        // Manter status atual se ticket estiver aberto/aceito
        if (ticket.status === "open" && ticket.userId) {
          // Ticket aceito por atendente - manter status, atendente e fila
          console.log(`✅ Mantendo ticket aberto com atendente ${ticket.userId} e fila ${ticket.queueId}`);
          await ticket.update({ unreadMessages, whatsappId });
        } else if (ticket.status === "closed") {
          // CORREÇÃO DEFINITIVA: Verificar se é resposta após avaliação
          if (ticket.lastMessage && ticket.lastMessage.includes("Por gentileza, avalie seu atendimento pelo link abaixo:")) {
            console.log(`🔒 Ticket fechado com avaliação - NÃO reabrir`);
            return ticket; // Mantém fechado
          }
          
          // CORREÇÃO: Não reabrir ticket se a mensagem for de avaliação automática
          if (messageInfo?.body && messageInfo.body.startsWith("Por gentileza, avalie seu atendimento pelo link abaixo:")) {
            console.log(`🚫 Ignorando reabertura - Mensagem de avaliação automática`);
            // Atualizar apenas a lastMessage sem reabrir o ticket
            await ticket.update({ 
              lastMessage: messageInfo.body,
              unreadMessages, 
              whatsappId 
            });
            return ticket; // Retorna o ticket fechado sem reabrir
          }
          
          // Ticket fechado - SEMPRE reabrir como 'pending' para ir para fila de aguardando
          console.log(`🔄 Reabrindo ticket fechado - Indo para PENDING (aguardando)`);
          await ticket.update({ 
            status: "pending", 
            userId: null,  // Limpar atendente para ir para fila
            unreadMessages, 
            whatsappId 
            // Manter queueId para preservar a fila original
          });
        } else {
          // Outros status (pending) - atualizar normalmente
          console.log(`📝 Atualizando ticket status: ${ticket.status}, fila: ${ticket.queueId}`);
          await ticket.update({ unreadMessages, whatsappId });
        }
      }
    }

  // Só buscar tickets antigos se não foi forçada a criação de novo ticket
  if (!ticket && groupContact) {
    ticket = await Ticket.findOne({
      where: {
        contactId: groupContact.id,
        whatsappId
      },
      order: [["updatedAt", "DESC"]]
    });

    if (ticket) {
      await ticket.update({
        status: "pending",
        userId: null,
        unreadMessages,
        queueId: null,
        companyId
      });
      await FindOrCreateATicketTrakingService({
        ticketId: ticket.id,
        companyId,
        whatsappId: ticket.whatsappId,
        userId: ticket.userId
      });
    }
    const msgIsGroupBlock = await Setting.findOne({
      where: { key: "timeCreateNewTicket" }
    });
  
    const value = msgIsGroupBlock ? parseInt(msgIsGroupBlock.value, 10) : 7200;
  }

  if (!ticket && !groupContact) {
    ticket = await Ticket.findOne({
      where: {
        updatedAt: {
          [Op.between]: [+subHours(new Date(), 2), +new Date()]
        },
        contactId: contact.id,
        whatsappId
      },
      order: [["updatedAt", "DESC"]]
    });

    if (ticket) {
      await ticket.update({
        status: "pending",
        userId: null,
        unreadMessages,
        queueId: null,
        companyId
      });
      await FindOrCreateATicketTrakingService({
        ticketId: ticket.id,
        companyId,
        whatsappId: ticket.whatsappId,
        userId: ticket.userId
      });
    }
  }
  
    const whatsapp = await Whatsapp.findOne({
    where: { id: whatsappId }
  });

  if (!ticket) {
    try {
      // Tentar criar novo ticket
      ticket = await Ticket.create({
        contactId: groupContact ? groupContact.id : contact.id,
        status: "pending",
        isGroup: !!groupContact,
        unreadMessages,
        whatsappId,
        companyId
      });
      console.log(`✅ Novo ticket criado: #${ticket.id} para contato ${contact.number} na conexão ${whatsappId}`);
    } catch (error) {
      // Se der erro de constraint, buscar ticket existente
      if (error.name === 'SequelizeUniqueConstraintError') {
        ticket = await Ticket.findOne({
          where: {
            contactId: groupContact ? groupContact.id : contact.id,
            whatsappId,
            companyId
          },
          order: [["id", "DESC"]]
        });
        
        if (ticket) {
          console.log(`🔄 Ticket existente encontrado: #${ticket.id} para conexão ${whatsappId}`);
          await ticket.update({ unreadMessages, status: "pending" });
        } else {
          throw error; // Se não encontrou ticket, relançar erro original
        }
      } else {
        throw error; // Outros erros, relançar
      }
    }
    
    await FindOrCreateATicketTrakingService({
      ticketId: ticket.id,
      companyId,
      whatsappId,
      userId: ticket.userId
    });
  }

  ticket = await ShowTicketService(ticket.id, companyId);

  return ticket;
};

export default FindOrCreateTicketService;
