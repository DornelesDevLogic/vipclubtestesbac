import { Op } from "sequelize";
import AppError from "../errors/AppError";
import Ticket from "../models/Ticket";

const CheckContactOpenTickets = async (contactId: number, whatsappId?: string): Promise<void> => {
  // Apenas verificar se já existe ticket aberto na MESMA conexão
  if (whatsappId) {
    const ticket = await Ticket.findOne({
      where: {
        contactId,
        status: { [Op.or]: ["open", "pending"] },
        whatsappId
      }
    });
    
    if (ticket) {
      throw new AppError("ERR_OTHER_OPEN_TICKET");
    }
  }
  // Se não tem whatsappId, não fazer verificação (permitir múltiplas conexões)
};

export default CheckContactOpenTickets;
