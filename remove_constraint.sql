-- Remover constraint única para permitir múltiplos tickets por conexão
ALTER TABLE "Tickets" DROP CONSTRAINT IF EXISTS "contactid_companyid_unique";