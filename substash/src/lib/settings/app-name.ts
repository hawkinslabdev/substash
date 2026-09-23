import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const DEFAULT_APP_NAME = "Substash";

export function getAppName(): string {
  const row = db
    .select()
    .from(settings)
    .where(eq(settings.key, "app_name"))
    .get();
  return row?.value || DEFAULT_APP_NAME;
}
