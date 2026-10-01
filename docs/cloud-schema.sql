-- PROPOSED PostgreSQL schema for the optional sync service, not a deployed migration.
-- Requires a separate reviewed auth/API implementation. Test under a non-owner role.
-- Tenant IDs in requests never establish authorization.
BEGIN;
CREATE SCHEMA IF NOT EXISTS aster;

CREATE TABLE aster.users (
  id uuid PRIMARY KEY,
  auth_subject text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE aster.devices (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES aster.users(id),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE aster.vaults (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES aster.users(id),
  next_sequence bigint NOT NULL DEFAULT 1 CHECK (next_sequence > 0),
  encryption_mode text NOT NULL DEFAULT 'e2ee' CHECK (encryption_mode IN ('e2ee', 'server-processing')),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE TABLE aster.vault_members (
  vault_id uuid NOT NULL REFERENCES aster.vaults(id),
  user_id uuid NOT NULL REFERENCES aster.users(id),
  role text NOT NULL CHECK (role IN ('owner', 'editor', 'reader')),
  revoked_at timestamptz,
  PRIMARY KEY (vault_id, user_id)
);
CREATE INDEX vault_members_user ON aster.vault_members(user_id, vault_id) WHERE revoked_at IS NULL;
CREATE TABLE aster.blobs (
  vault_id uuid NOT NULL REFERENCES aster.vaults(id),
  id uuid NOT NULL,
  object_key text NOT NULL UNIQUE,
  ciphertext_digest text NOT NULL CHECK (ciphertext_digest ~ '^[a-f0-9]{64}$'),
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  key_version integer NOT NULL CHECK (key_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (vault_id, id)
);
CREATE TABLE aster.entity_heads (
  vault_id uuid NOT NULL REFERENCES aster.vaults(id),
  entity_id uuid NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('note', 'relationship', 'view')),
  revision text NOT NULL CHECK (revision ~ '^[a-f0-9]{64}$'),
  blob_id uuid,
  deleted boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (vault_id, entity_id),
  FOREIGN KEY (vault_id, blob_id) REFERENCES aster.blobs(vault_id, id)
);
CREATE TABLE aster.sync_operations (
  vault_id uuid NOT NULL REFERENCES aster.vaults(id),
  operation_id uuid NOT NULL,
  sequence bigint NOT NULL CHECK (sequence > 0),
  device_id uuid NOT NULL REFERENCES aster.devices(id),
  entity_id uuid NOT NULL,
  base_revision text,
  resulting_revision text NOT NULL,
  action text NOT NULL CHECK (action IN ('put', 'tombstone')),
  blob_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (vault_id, operation_id),
  UNIQUE (vault_id, sequence),
  FOREIGN KEY (vault_id, entity_id) REFERENCES aster.entity_heads(vault_id, entity_id),
  FOREIGN KEY (vault_id, blob_id) REFERENCES aster.blobs(vault_id, id)
);
CREATE TABLE aster.device_cursors (
  vault_id uuid NOT NULL REFERENCES aster.vaults(id),
  device_id uuid NOT NULL REFERENCES aster.devices(id),
  acknowledged_sequence bigint NOT NULL DEFAULT 0 CHECK (acknowledged_sequence >= 0),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (vault_id, device_id)
);
CREATE TABLE aster.job_outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vault_id uuid NOT NULL REFERENCES aster.vaults(id),
  kind text NOT NULL,
  dedupe_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);
CREATE INDEX job_outbox_pending ON aster.job_outbox(id) WHERE published_at IS NULL;

-- The API verifies the session, then sets LOCAL aster.actor_id inside each transaction.
-- Never let arbitrary SQL or a client-supplied user ID set this value.
CREATE FUNCTION aster.actor_id() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('aster.actor_id', true), '')::uuid;
$$;

ALTER TABLE aster.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE aster.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE aster.vaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE aster.vault_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE aster.blobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE aster.entity_heads ENABLE ROW LEVEL SECURITY;
ALTER TABLE aster.sync_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE aster.device_cursors ENABLE ROW LEVEL SECURITY;
ALTER TABLE aster.job_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY self_user ON aster.users FOR SELECT USING (id = aster.actor_id());
CREATE POLICY self_device ON aster.devices FOR SELECT USING (user_id = aster.actor_id());
CREATE POLICY self_membership ON aster.vault_members FOR SELECT USING (user_id = aster.actor_id() AND revoked_at IS NULL);
CREATE POLICY vault_read ON aster.vaults FOR SELECT USING (
  deleted_at IS NULL AND id IN (SELECT vault_id FROM aster.vault_members WHERE user_id = aster.actor_id() AND revoked_at IS NULL)
);
CREATE POLICY blob_read ON aster.blobs FOR SELECT USING (
  vault_id IN (SELECT id FROM aster.vaults)
);
CREATE POLICY entity_read ON aster.entity_heads FOR SELECT USING (
  vault_id IN (SELECT id FROM aster.vaults)
);
CREATE POLICY operation_read ON aster.sync_operations FOR SELECT USING (
  vault_id IN (SELECT id FROM aster.vaults)
);
CREATE POLICY cursor_read ON aster.device_cursors FOR SELECT USING (
  vault_id IN (SELECT id FROM aster.vaults) AND device_id IN (SELECT id FROM aster.devices WHERE user_id = aster.actor_id() AND revoked_at IS NULL)
);

-- Fail closed: no mutation policies or application grants are defined in this draft.
-- A reviewed write transaction must check membership, device ownership/revocation,
-- quota, blob ownership and base revision, then atomically allocate a sequence,
-- update the entity head, append the operation and enqueue the outbox event.
-- Application connections must not own these tables and must not have BYPASSRLS.
-- Privileged membership/account provisioning and worker roles remain to be designed.
COMMIT;
