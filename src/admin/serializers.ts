export interface IdentityRow {
  id: number | null;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export function serializeAdminIdentity(row: IdentityRow | null) {
  if (!row || row.id === null || !row.email) {
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    display_name: row.displayName,
    avatar_url: row.avatarUrl,
  };
}
