import {
  WASocket,
  BinaryNode,
  Contact as BContact,
} from "baileys";
import * as Sentry from "@sentry/node";

import { Op } from "sequelize";
// import { getIO } from "../../libs/socket";
import { Store } from "../../libs/store";
import Contact from "../../models/Contact";
import Setting from "../../models/Setting";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import { logger } from "../../utils/logger";
import createOrUpdateBaileysService from "../BaileysServices/CreateOrUpdateBaileysService";
import CreateMessageService from "../MessageServices/CreateMessageService";
//import { addContactsUpdateJob } from "./ProcessContactsUpdate";


type Session = WASocket & {
  id?: number;
  store?: Store;
};

interface IContact {
  contacts: BContact[];
}

const wbotMonitor = async (
  wbot: Session,
  whatsapp: Whatsapp,
  companyId: number
): Promise<void> => {
  try {
    wbot.ws.on("CB:call", async (node: BinaryNode) => {
      // Callback de evento: o try/catch da função externa só protege o
      // registro do listener, não a execução dele quando o evento chega
      // de fato. Sem essa blindagem própria, qualquer erro aqui dentro
      // vira um unhandledRejection e derruba o processo inteiro.
      try {
        const content = node.content[0] as any;

        if (content.tag === "offer") {
          const { from, id } = node.attrs;

        }

        if (content.tag === "terminate") {
          const sendMsgCall = await Setting.findOne({
            where: { key: "call", companyId },
          });

          if (sendMsgCall?.value === "disabled") {
            await wbot.sendMessage(node.attrs.from, {
              text:
                "*Mensagem Automática:*\n\nAs chamadas de voz e vídeo estão desabilitas para esse WhatsApp, favor enviar uma mensagem de texto. Obrigado",
            });

            const number = node.attrs.from.replace(/\D/g, "");

            const contact = await Contact.findOne({
              where: { companyId, number },
            });

            // Sem contato cadastrado pra esse número, não tem ticket pra
            // registrar a chamada perdida.
            if (!contact) return;

            const ticket = await Ticket.findOne({
              where: {
                contactId: contact.id,
                whatsappId: wbot.id,
                //status: { [Op.or]: ["close"] },
                companyId
              },
            });
            // se não existir o ticket não faz nada.
            if (!ticket) return;

            const date = new Date();
            const hours = date.getHours();
            const minutes = date.getMinutes();

            const body = `Chamada de voz/vídeo perdida às ${hours}:${minutes}`;
            const messageData = {
              id: content.attrs["call-id"],
              ticketId: ticket.id,
              contactId: contact.id,
              body,
              fromMe: false,
              mediaType: "call_log",
              read: true,
              quotedMsgId: null,
              ack: 1,
            };

            await ticket.update({
              lastMessage: body,
            });


            if(ticket.status === "closed") {
              await ticket.update({
                status: "pending",
              });
            }

            await CreateMessageService({ messageData, companyId: companyId });
          }
        }
      } catch (err) {
        Sentry.captureException(err);
        logger.error(`Erro no listener CB:call: ${err instanceof Error ? err.message : err}`);
      }
    });

    wbot.ev.on("contacts.upsert", async (contacts: BContact[]) => {
      try {
        await createOrUpdateBaileysService({
          whatsappId: whatsapp.id,
          contacts,
        });
      } catch (err) {
        Sentry.captureException(err);
        logger.error(`Erro no listener contacts.upsert: ${err instanceof Error ? err.message : err}`);
      }
    });

  } catch (err) {
    Sentry.captureException(err);
    logger.error(err);
  }
};

export default wbotMonitor;