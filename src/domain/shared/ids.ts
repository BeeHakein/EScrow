import type { Brand } from './brand';

// Opaque identifiers. One brand per aggregate — an EscrowId can never be used as a ContractId.
export type UserId = Brand<string, 'UserId'>;
export type PartyId = Brand<string, 'PartyId'>;
export type ContractId = Brand<string, 'ContractId'>;
export type ClauseId = Brand<string, 'ClauseId'>;
export type RiskReportId = Brand<string, 'RiskReportId'>;
export type EscrowId = Brand<string, 'EscrowId'>;
export type MilestoneId = Brand<string, 'MilestoneId'>;
