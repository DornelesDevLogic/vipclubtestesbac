import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { getWbot } from "../../libs/wbot";
import { logger } from "../../utils/logger";

interface IOnWhatsapp {
  jid: string;
  exists: boolean;
}

const checker = async (number: string, wbot: any) => {
  if (number.includes("@lid")) {
    const lidMappingStore = wbot.lidMappingStore;
    if (lidMappingStore) {
      const jid = await lidMappingStore.getPNForLID(number);
      if (jid) {
        const [validNumber] = await wbot.onWhatsApp(jid);
        return validNumber;
      }
    }
  }

  if (number.includes("@")) {
    const [validNumber] = await wbot.onWhatsApp(number);
    return validNumber;
  }

  const [validNumber] = await wbot.onWhatsApp(`${number}@s.whatsapp.net`);

  logger.info(validNumber);

  return validNumber;
};

const CheckContactNumber = async (
  number: string,
  companyId: number
): Promise<IOnWhatsapp> => {
  const defaultWhatsapp = await GetDefaultWhatsApp(companyId);

  const wbot = getWbot(defaultWhatsapp.id);
  const isNumberExit = await checker(number, wbot);

  if (!isNumberExit || !isNumberExit.exists) {
    throw new Error("ERR_CHECK_NUMBER");
  }
  return isNumberExit;
};

export default CheckContactNumber;
