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
  // Verificar se existe ticket aberto/pendente para este contato em OUTRA conexão
  const existingTicketOtherConnection = await Ticket.findOne({
    where: {
      status: {
        [Op.or]: ["open", "pending"]
      },
      contactId: groupContact ? groupContact.id : contact.id,
      companyId,
      whatsappId: {
        [Op.ne]: whatsappId
      }
    },
    order: [["id", "DESC"]]
  });

  let ticket;
  
  // Se existe ticket aberto em outra conexão, forçar criação de novo ticket
  if (existingTicketOtherConnection) {
    console.log(`🔄 Contato ${contact.number} tem ticket aberto na conexão ${existingTicketOtherConnection.whatsappId}, criando novo ticket na conexão ${whatsappId}`);
    ticket = null; // Forçar criação de novo ticket
  } else {
    // Buscar ticket existente na mesma conexão
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

    if (ticket) {
      if (openTicketSchedule) {
        await ticket.update({ status: "open", unreadMessages });
      }
      await ticket.update({ unreadMessages, whatsappId });
    }

    
    if (ticket?.status === "closed") {
      await ticket.update({ queueId: null, userId: null });
    }
  }

  // Só buscar tickets antigos se não foi forçada a criação de novo ticket
  if (!ticket && !existingTicketOtherConnection && groupContact) {
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

  if (!ticket && !existingTicketOtherConnection && !groupContact) {
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
      console.log(`✅ Novo ticket criado: #${ticket.id} para conexão ${whatsappId}`);
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
