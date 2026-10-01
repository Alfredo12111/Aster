import { it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { pushRequestSchema } from '../packages/sync-contract/protocol';
it('rejects cross-vault operations and duplicate operation IDs before service authorization', () => {
  const vaultId = randomUUID();
  const op = { operationId: randomUUID(), vaultId, deviceId: randomUUID(), entityId: randomUUID(), entityType: 'note', action: 'put', baseRevision: null, contentDigest: 'a'.repeat(64), blobId: randomUUID(), keyVersion: 1 };
  expect(pushRequestSchema.safeParse({ protocolVersion: 1, vaultId, operations: [op] }).success).toBe(true);
  expect(pushRequestSchema.safeParse({ protocolVersion: 1, vaultId: randomUUID(), operations: [op] }).success).toBe(false);
  expect(pushRequestSchema.safeParse({ protocolVersion: 1, vaultId, operations: [op, op] }).success).toBe(false);
});
