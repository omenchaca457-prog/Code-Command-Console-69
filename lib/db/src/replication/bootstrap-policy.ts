export type ReplicaTableDigest = {
  table: string;
  rows: number;
  checksum: string;
};

export function replicaDigestsMatch(
  primary: ReplicaTableDigest[],
  replica: ReplicaTableDigest[],
): boolean {
  return primary.length === replica.length && primary.every((source, index) =>
    source.table === replica[index]?.table &&
    source.rows === replica[index]?.rows &&
    source.checksum === replica[index]?.checksum
  );
}

export function classifyReplicaBootstrap(
  primary: ReplicaTableDigest[],
  replica: ReplicaTableDigest[],
): "copy-empty-target" | "verify-existing" {
  if (replicaDigestsMatch(primary, replica)) return "verify-existing";
  if (replica.every((digest) => digest.rows === 0)) return "copy-empty-target";
  throw new Error("Neon contains conflicting data; no rows were changed.");
}
