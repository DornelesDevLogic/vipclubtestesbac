import { Request, Response } from "express";
import CleanupEvaluationTicketsService from "../services/TicketServices/CleanupEvaluationTicketsService";

export const cleanupEvaluationTickets = async (req: Request, res: Response): Promise<Response> => {
  try {
    await CleanupEvaluationTicketsService();
    return res.json({ message: "Limpeza de tickets com avaliação executada com sucesso" });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao executar limpeza de tickets", details: error.message });
  }
};