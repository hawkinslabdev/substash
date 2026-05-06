export type CursorPayload = {
  page: number;
  perPage: number;
  total: number;
  sort: string;
  seed?: number;
  tagId?: string;
  studioId?: string;
  performerId?: string;
};

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string): CursorPayload {
  return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
}

export function hasNextPage(payload: CursorPayload): boolean {
  return payload.page * payload.perPage < payload.total;
}

export function nextCursor(payload: CursorPayload): string | null {
  if (!hasNextPage(payload)) return null;
  return encodeCursor({ ...payload, page: payload.page + 1 });
}
