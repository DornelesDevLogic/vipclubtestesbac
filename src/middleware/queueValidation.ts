/**
 * Middleware de Validação de Filas
 * 
 * Intercepta e valida mudanças de fila para prevenir bugs
 * de atribuição incorreta de filas nos tickets.
 */

import Ticket from "../models/Ticket";
import { queueDebugger } from "../utils/queueDebugger";

interface QueueValidationOptions {
  allowForceChange?: boolean;
  reason?: string;
}

/**
 * Valida se uma mudança de fila é permitida
 */
export const validateQueueAssignment = async (
  ticketId: number,
  newQueueId: number | null,
  newUserId: number | null,
  options: QueueValidationOptions = {}
): Promise<boolean> => {
  try {
    const ticket = await Ticket.findByPk(ticketId);
    
    if (!ticket) {
      console.log(`❌ Ticket #${ticketId} não encontrado para validação de fila`);
      return false;
    }

    const { allowForceChange = false, reason = 'Não especificado' } = options;

    // Regra 1: Se ticket tem atendente ativo, não permitir mudança automática de fila
    if (ticket.userId && ticket.status === 'open' && newQueueId && ticket.queueId !== newQueueId) {
      if (!allowForceChange) {
        console.log(`🚫 BLOQUEADO: Tentativa de alterar fila de ticket com atendente ativo`);
        console.log(`   Ticket #${ticketId} - Atendente: ${ticket.userId} - Fila atual: ${ticket.queueId} - Nova fila: ${newQueueId}`);
        console.log(`   Motivo: ${reason}`);
        
        queueDebugger.logQueueChange(
          ticketId,
          'N/A',
          ticket.queueId,
          newQueueId,
          ticket.userId,
          newUserId,
          `BLOQUEADO: ${reason}`
        );
        
        return false;
      } else {
        console.log(`⚠️ FORÇADO: Alteração de fila permitida por força - ${reason}`);
      }
    }

    // Regra 2: Se ticket está em atendimento (status open), preservar configuração
    if (ticket.status === 'open' && ticket.userId && !allowForceChange) {
      if (newQueueId && ticket.queueId !== newQueueId) {
        console.log(`🚫 BLOQUEADO: Ticket em atendimento não deve ter fila alterada`);
        return false;
      }
      
      if (newUserId && ticket.userId !== newUserId) {
        console.log(`⚠️ ATENÇÃO: Alterando atendente de ticket em andamento`);
      }
    }

    // Regra 3: Validar se nova fila existe (se especificada)
    if (newQueueId) {
      // Aqui poderia adicionar validação se a fila existe
      // const queue = await Queue.findByPk(newQueueId);
      // if (!queue) return false;
    }

    return true;
  } catch (error) {
    console.log(`❌ Erro na validação de fila para ticket #${ticketId}:`, error);
    return false;
  }
};

/**
 * Middleware para interceptar mudanças de ticket
 */
export const interceptTicketUpdate = (originalUpdate: Function) => {
  return async function(this: any, values: any, options: any) {
    const ticketId = this.id;
    const currentQueueId = this.queueId;
    const currentUserId = this.userId;
    const newQueueId = values.queueId;
    const newUserId = values.userId;

    // Se há mudança de fila, validar
    if (newQueueId !== undefined && newQueueId !== currentQueueId) {
      const isValid = await validateQueueAssignment(
        ticketId,
        newQueueId,
        newUserId,
        {
          reason: 'Atualização direta do modelo',
          allowForceChange: options?.force || false
        }
      );

      if (!isValid && !options?.force) {
        console.log(`🚫 Atualização de fila bloqueada para ticket #${ticketId}`);
        // Remove a mudança de fila dos valores
        delete values.queueId;
      }
    }

    // Chamar o método original
    return originalUpdate.call(this, values, options);
  };
};

/**
 * Função para aplicar validação em operações de fila
 */
export const safeQueueUpdate = async (
  ticketId: number,
  queueId: number | null,
  userId: number | null,
  reason: string,
  force: boolean = false
): Promise<boolean> => {
  const isValid = await validateQueueAssignment(ticketId, queueId, userId, {
    reason,
    allowForceChange: force
  });

  if (!isValid) {
    console.log(`🚫 Operação de fila rejeitada: ${reason}`);
    return false;
  }

  try {
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) return false;

    const updateData: any = {};
    if (queueId !== undefined) updateData.queueId = queueId;
    if (userId !== undefined) updateData.userId = userId;

    await ticket.update(updateData, { force });
    
    queueDebugger.logQueueChange(
      ticketId,
      'N/A',
      ticket.queueId,
      queueId,
      ticket.userId,
      userId,
      `SUCESSO: ${reason}`
    );

    return true;
  } catch (error) {
    console.log(`❌ Erro ao atualizar fila: ${error}`);
    return false;
  }
};