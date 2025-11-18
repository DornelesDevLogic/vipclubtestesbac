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

const FindOrCreateTicketService = async (
  contact: Contact,
  whatsappId: number,
  unreadMessages: number,
  companyId: number,
  groupContact?: Contact,
  openTicketSchedule?: boolean
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
      console.log(`🔍 Ticket encontrado: #${ticket.id} - Status: ${ticket.status}, UserId: ${ticket.userId}`);
      
      if (openTicketSchedule) {
        await ticket.update({ status: "open", unreadMessages });
      } else {
        // Manter status atual se ticket estiver aberto/aceito
        if (ticket.status === "open" && ticket.userId) {
          // Ticket aceito por atendente - manter status e atendente
          console.log(`✅ Mantendo ticket aberto com atendente ${ticket.userId}`);
          await ticket.update({ unreadMessages, whatsappId });
        } else if (ticket.status === "closed") {
          // Ticket fechado - limpar fila e atendente
          console.log(`🔄 Reabrindo ticket fechado`);
          await ticket.update({ queueId: null, userId: null, unreadMessages, whatsappId });
        } else {
          // Outros status (pending) - atualizar normalmente
          console.log(`📝 Atualizando ticket status: ${ticket.status}`);
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
