/**
 * Ponto único de agregação do schema.
 *
 * Cada módulo define suas próprias tabelas; este arquivo só as reúne para o
 * drizzle-kit conseguir gerar as migrações e para o cliente do banco montar o
 * mapa de relações. É o único lugar do projeto que enxerga todos os módulos ao
 * mesmo tempo — e por isso não contém regra de negócio nenhuma.
 */

export * from "@/modules/auth/user.schema";
export * from "@/modules/clients/client.schema";
export * from "@/modules/agenda/professional.schema";
export * from "@/modules/agenda/service.schema";
export * from "@/modules/agenda/appointment.schema";
export * from "@/modules/agenda/schedule.schema";
export * from "@/modules/inventory/product.schema";
export * from "@/modules/inventory/stock-movement.schema";
export * from "@/modules/shared/future.schema";
