/**
 * Sistema de Debug para Filas - Correção de Bug de Troca de Filas
 * 
 * Este arquivo contém funções para monitorar e debugar problemas
 * relacionados à atribuição incorreta de filas nos tickets.
 */

import { logger } from "./logger";
import Ticket from "../models/Ticket";
import Contact from "../models/Contact";
import Queue from "../models/Queue";
import User from "../models/User";

interface QueueChangeLog {
  ticketId: number;
  contactNumber: string;
  oldQueueId?: number;
  newQueueId?: number;
  oldUserId?: number;
  newUserId?: number;
  reason: string;
  timestamp: Date;
}

class QueueDebugger {
  private static instance: QueueDebugger;
  private queueChanges: QueueChangeLog[] = [];

  public static getInstance(): QueueDebugger {
    if (!QueueDebugger.instance) {
      QueueDebugger.instance = new QueueDebugger();
    }
    return QueueDebugger.instance;
  }

  /**
   * Registra uma mudança de fila para debug
   */
  public logQueueChange(
    ticketId: number,
    contactNumber: string,
    oldQueueId: number | undefined,
    newQueueId: number | undefined,
    oldUserId: number | undefined,
    newUserId: number | undefined,
    reason: string
  ): void {
    const change: QueueChangeLog = {
      ticketId,
      contactNumber,
      oldQueueId,
      newQueueId,
      oldUserId,
      newUserId,
      reason,
      timestamp: new Date()
    };

    this.queueChanges.push(change);

    // Manter apenas os últimos 100 registros
    if (this.queueChanges.length > 100) {
      this.queueChanges.shift();
    }

    // Log detalhado
    console.log(`🔄 MUDANÇA DE FILA - Ticket #${ticketId}:`);
    console.log(`   📞 Contato: ${contactNumber}`);
    console.log(`   📋 Fila: ${oldQueueId || 'null'} → ${newQueueId || 'null'}`);
    console.log(`   👤 Atendente: ${oldUserId || 'null'} → ${newUserId || 'null'}`);
    console.log(`   📝 Motivo: ${reason}`);
    console.log(`   ⏰ Timestamp: ${change.timestamp.toISOString()}`);

    // Log crítico se fila mudou sem motivo aparente
    if (oldQueueId && newQueueId && oldQueueId !== newQueueId && !reason.includes('transferência')) {
      console.log(`🚨 ALERTA: Possível troca indevida de fila!`);
      logger.error(`QUEUE_BUG: Ticket #${ticketId} teve fila alterada de ${oldQueueId} para ${newQueueId} - Motivo: ${reason}`);
    }
  }

  /**
   * Valida se uma mudança de fila é válida
   */
  public validateQueueChange(
    ticket: Ticket,
    newQueueId: number | undefined,
    newUserId: number | undefined,
    reason: string
  ): boolean {
    // Se ticket já tem atendente, não deve mudar fila automaticamente
    if (ticket.userId && newQueueId && ticket.queueId !== newQueueId && !reason.includes('transferência')) {
      console.log(`❌ BLOQUEADO: Tentativa de alterar fila de ticket com atendente`);
      console.log(`   Ticket #${ticket.id} - Atendente: ${ticket.userId} - Fila atual: ${ticket.queueId} - Nova fila: ${newQueueId}`);
      return false;
    }

    // Se ticket já tem fila e não tem atendente, verificar se mudança é necessária
    if (ticket.queueId && !ticket.userId && newQueueId && ticket.queueId !== newQueueId && !reason.includes('bot')) {
      console.log(`⚠️ ATENÇÃO: Alterando fila de ticket sem atendente`);
      console.log(`   Ticket #${ticket.id} - Fila atual: ${ticket.queueId} - Nova fila: ${newQueueId} - Motivo: ${reason}`);
    }

    return true;
  }

  /**
   * Obtém histórico de mudanças para um ticket específico
   */
  public getTicketHistory(ticketId: number): QueueChangeLog[] {
    return this.queueChanges.filter(change => change.ticketId === ticketId);
  }

  /**
   * Obtém estatísticas de mudanças de fila
   */
  public getStats(): any {
    const totalChanges = this.queueChanges.length;
    const suspiciousChanges = this.queueChanges.filter(change => 
      change.oldQueueId && 
      change.newQueueId && 
      change.oldQueueId !== change.newQueueId && 
      !change.reason.includes('transferência')
    ).length;

    return {
      totalChanges,
      suspiciousChanges,
      suspiciousPercentage: totalChanges > 0 ? (suspiciousChanges / totalChanges * 100).toFixed(2) : 0
    };
  }

  /**
   * Limpa o histórico de mudanças
   */
  public clearHistory(): void {
    this.queueChanges = [];
    console.log(`🧹 Histórico de mudanças de fila limpo`);
  }
}

export const queueDebugger = QueueDebugger.getInstance();

/**
 * Função helper para validar estado do ticket antes de mudanças
 */
export const validateTicketState = async (ticketId: number): Promise<void> => {
  try {
    const ticket = await Ticket.findByPk(ticketId, {
      include: [
        { model: Contact, as: "contact" },
        { model: Queue, as: "queue" },
        { model: User, as: "user" }
      ]
    });

    if (!ticket) {
      console.log(`❌ Ticket #${ticketId} não encontrado`);
      return;
    }

    console.log(`🔍 ESTADO DO TICKET #${ticketId}:`);
    console.log(`   📞 Contato: ${ticket.contact.number} (${ticket.contact.name})`);
    console.log(`   📋 Fila: ${ticket.queue?.name || 'Nenhuma'} (ID: ${ticket.queueId || 'null'})`);
    console.log(`   👤 Atendente: ${ticket.user?.name || 'Nenhum'} (ID: ${ticket.userId || 'null'})`);
    console.log(`   📊 Status: ${ticket.status}`);
    console.log(`   📱 WhatsApp: ${ticket.whatsappId}`);
    console.log(`   🤖 Chatbot: ${ticket.chatbot ? 'Ativo' : 'Inativo'}`);
    console.log(`   🔗 Integração: ${ticket.useIntegration ? 'Ativa' : 'Inativa'}`);
  } catch (error) {
    console.log(`❌ Erro ao validar estado do ticket #${ticketId}:`, error);
  }
};