import { z } from 'zod';
/** Versioned contract for the future opt-in sync service. No network sync runs in this alpha. */
const uuid = z.string().uuid();
export const operationSchema = z.object({
  operationId: uuid,
  vaultId: uuid,
  deviceId: uuid,
  entityId: uuid,
  entityType: z.enum(['note', 'relationship', 'view']),
  action: z.enum(['put', 'tombstone']),
  baseRevision: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  contentDigest: z.string().regex(/^[a-f0-9]{64}$/),
  // Reference to an uploaded ciphertext object, never an arbitrary filesystem path or URL.
  blobId: uuid.nullable(),
  keyVersion: z.number().int().positive(),
});
export const pushRequestSchema = z.object({ protocolVersion: z.literal(1), vaultId: uuid, operations: z.array(operationSchema).min(1).max(100) }).superRefine((request, ctx) => {
  const ids = new Set<string>();
  request.operations.forEach((op, index) => {
    if (op.vaultId !== request.vaultId) ctx.addIssue({ code: 'custom', path: ['operations', index], message: 'Operation belongs to a different vault' });
    if (ids.has(op.operationId)) ctx.addIssue({ code: 'custom', path: ['operations', index], message: 'Duplicate operation in batch' });
    ids.add(op.operationId);
  });
});
export type SyncOperation = z.infer<typeof operationSchema>;
export type PushRequest = z.infer<typeof pushRequestSchema>;
export type OperationResult =
  | { operationId: string; status: 'accepted' | 'already-applied'; sequence: string; revision: string }
  | { operationId: string; status: 'conflict'; currentRevision: string; currentBlobId: string | null }
  | { operationId: string; status: 'rejected'; code: 'forbidden' | 'quota' | 'invalid-blob' };
export type PullResponse = { protocolVersion: 1; vaultId: string; operations: (SyncOperation & { sequence: string })[]; nextCursor: string; hasMore: boolean };
