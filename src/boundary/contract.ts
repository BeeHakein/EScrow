import type { Clause, ClauseCategory } from '../domain/clause';
import type { DocumentFormat } from '../domain/contract';
import type { ClauseId, ContractId, PartyId } from '../domain/shared/ids';
import { type Result, ok, err } from '../domain/shared/result';

// Untrusted shapes crossing the system edge at upload time: the user's upload command and the
// document parser's extracted clauses. Both stay loosely typed until parsed here — the HTTP
// client and the PDF/DOCX parser sit OUTSIDE the trust boundary.

const CLAUSE_CATEGORIES: readonly ClauseCategory[] = [
  'payment',
  'intellectual_property',
  'termination',
  'liability',
  'confidentiality',
  'scope',
  'dispute_resolution',
  'other',
];
const isClauseCategory = (v: unknown): v is ClauseCategory =>
  typeof v === 'string' && (CLAUSE_CATEGORIES as readonly string[]).includes(v);

const DOCUMENT_FORMATS: readonly DocumentFormat[] = ['pdf', 'docx'];
const isDocumentFormat = (v: unknown): v is DocumentFormat =>
  typeof v === 'string' && (DOCUMENT_FORMATS as readonly string[]).includes(v);

// One clause as returned by the document parser. heading may be absent; category is a
// suggestion validated against the closed set here.
export interface RawClause {
  readonly heading?: string | null;
  readonly text: string;
  readonly category: string;
}

export interface RawDocument {
  readonly clauses: readonly RawClause[];
}

// The validated upload command. Built by parseUploadCommand from raw request input; the
// use-case trusts it thereafter.
export interface UploadContractCommand {
  readonly title: string;
  readonly format: DocumentFormat;
  readonly uploadedBy: PartyId;
  readonly bytes: Uint8Array;
}

export interface RawUploadCommand {
  readonly title: unknown;
  readonly format: unknown;
  readonly uploadedBy: unknown;
  readonly bytes: unknown;
}

export function parseUploadCommand(raw: RawUploadCommand): Result<UploadContractCommand> {
  if (typeof raw.title !== 'string' || raw.title.trim().length === 0) return err('title is required');
  if (!isDocumentFormat(raw.format)) return err(`unsupported document format: ${String(raw.format)}`);
  if (typeof raw.uploadedBy !== 'string' || raw.uploadedBy.length === 0) return err('uploadedBy is required');
  if (!(raw.bytes instanceof Uint8Array) || raw.bytes.length === 0) return err('document bytes are required');
  return ok({
    title: raw.title.trim(),
    format: raw.format,
    uploadedBy: raw.uploadedBy as PartyId,
    bytes: raw.bytes,
  });
}

// Identity + ordering attached by the application (id generator + position), not by the parser.
export interface ClauseContext {
  readonly id: ClauseId;
  readonly contractId: ContractId;
  readonly index: number;
}

export function parseClause(raw: RawClause, ctx: ClauseContext): Result<Clause> {
  if (typeof raw.text !== 'string' || raw.text.trim().length === 0) return err(`clause ${ctx.index} has empty text`);
  if (!isClauseCategory(raw.category)) return err(`clause ${ctx.index} has invalid category: ${String(raw.category)}`);
  const heading = typeof raw.heading === 'string' && raw.heading.trim().length > 0 ? raw.heading.trim() : null;
  return ok({
    id: ctx.id,
    contractId: ctx.contractId,
    index: ctx.index,
    heading,
    text: raw.text,
    category: raw.category,
  });
}
