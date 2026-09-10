import Contact from "../../models/Contact";
import AppError from "../../errors/AppError";

const ShowContactService = async (
  id: string | number,
  companyId: number
): Promise<Contact> => {
  const contact = await Contact.findByPk(id, {
    include: [
      "extraInfo",
      // Carrega só o essencial da conexão: a coluna "session" guarda o estado
      // de criptografia do Baileys e pode chegar a dezenas de MB, o que
      // estourava o limite de payload ao editar o contato pelo frontend.
      { association: "whatsapp", attributes: ["id", "name"] }
    ]
  });

  if (contact?.companyId !== companyId) {
    throw new AppError("Não é possível excluir registro de outra empresa");
  }

  if (!contact) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  return contact;
};

export default ShowContactService;
