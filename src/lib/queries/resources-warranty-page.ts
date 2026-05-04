import { decodeHtmlEntities } from "../decode-html-entities";

export const WARRANTY_PAGE_URI = "/resources/warrantyregistration/";

export const WARRANTY_PAGE_QUERY = /* GraphQL */ `
  query WarrantyPage($id: ID!) {
    page(id: $id, idType: URI) {
      title
      content
      warrantyContactsSettings {
        warrantyContactsGroup {
          title
          subtitle
          contacts {
            icon
            text
          }
        }
      }
    }
  }
`;

export type WarrantyContactRaw = {
  icon?: string | string[] | null;
  text?: string | null;
};

export type WarrantyContactsGroupRaw = {
  title?: string | null;
  subtitle?: string | null;
  contacts?: WarrantyContactRaw[] | WarrantyContactRaw | null;
};

export type WarrantyPageData = {
  page?: {
    title?: string | null;
    content?: string | null;
    warrantyContactsSettings?: {
      warrantyContactsGroup?: WarrantyContactsGroupRaw | WarrantyContactsGroupRaw[] | null;
    } | null;
  } | null;
};

export type WarrantyContact = {
  iconKey: string | null;
  textHtml: string;
};

export type WarrantyContactsGroup = {
  title: string;
  subtitleHtml: string;
  contacts: WarrantyContact[];
};

function asArray<T>(x: T | T[] | null | undefined): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

function iconKeyFromRaw(icon: string | string[] | null | undefined): string | null {
  if (icon == null) return null;
  if (Array.isArray(icon)) {
    for (const item of icon) {
      if (typeof item !== "string") continue;
      const t = item.trim().toLowerCase();
      if (t) return t;
    }
    return null;
  }
  const t = icon.trim().toLowerCase();
  return t || null;
}

export function normalizeWarrantyContacts(
  page: WarrantyPageData["page"] | null | undefined,
): WarrantyContactsGroup[] {
  const groups = asArray(page?.warrantyContactsSettings?.warrantyContactsGroup);
  const out: WarrantyContactsGroup[] = [];
  for (const g of groups) {
    if (!g || typeof g !== "object") continue;
    const title = decodeHtmlEntities((g.title ?? "").trim());
    const subtitleHtml = decodeHtmlEntities((g.subtitle ?? "").trim());
    const rawContacts = asArray(g.contacts);
    const contacts: WarrantyContact[] = [];
    for (const c of rawContacts) {
      if (!c || typeof c !== "object") continue;
      const textHtml = decodeHtmlEntities((c.text ?? "").trim());
      const iconKey = iconKeyFromRaw(c.icon);
      if (!textHtml && !iconKey) continue;
      contacts.push({ iconKey, textHtml });
    }
    if (!title && !subtitleHtml && contacts.length === 0) continue;
    out.push({ title, subtitleHtml, contacts });
  }
  return out;
}
