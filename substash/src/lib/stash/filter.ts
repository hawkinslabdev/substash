import { STASH_TAGS_EXCLUDED, STASH_TAGS_INCLUDED } from "astro:env/server";

export type TaggedItem = {
  tags?: { name: string }[];
};

const excludedNames = (STASH_TAGS_EXCLUDED ?? "")
  .split(",")
  .map((t) => t.trim().toLowerCase())
  .filter(Boolean);

const includedNames = (STASH_TAGS_INCLUDED ?? "")
  .split(",")
  .map((t) => t.trim().toLowerCase())
  .filter(Boolean);

if (excludedNames.length > 0) {
  console.log(
    new Date().toTimeString().slice(0, 8),
    "[app] Excluding tags:",
    excludedNames,
  );
}
if (includedNames.length > 0) {
  console.log(
    new Date().toTimeString().slice(0, 8),
    "[app] Including tags:",
    includedNames,
  );
}

export function filterByTags<T extends TaggedItem>(items: T[]): T[] {
  if (excludedNames.length === 0 && includedNames.length === 0) return items;

  return items.filter((item) => {
    const tagNames = (item.tags ?? []).map((t) => t.name.toLowerCase());
    if (
      excludedNames.length > 0 &&
      excludedNames.some((n) => tagNames.includes(n))
    )
      return false;
    if (
      includedNames.length > 0 &&
      !includedNames.every((n) => tagNames.includes(n))
    )
      return false;
    return true;
  });
}

export function filterTagList<T extends { name: string }>(tags: T[]): T[] {
  if (excludedNames.length === 0) return tags;
  return tags.filter((tag) => !excludedNames.includes(tag.name.toLowerCase()));
}
