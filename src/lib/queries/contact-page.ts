/** Contact page (WordPress URI: /contact/) */

export const CONTACT_PAGE_URI = "/contact/";

export const CONTACT_PAGE_QUERY = /* GraphQL */ `
  query ContactPage($id: ID!) {
    page(id: $id, idType: URI) {
      title
      contactUsSettings {
        contactUsSupportGroup {
          title
          blocks {
            title
            contacts {
              icon
              text
            }
          }
        }
        contactUsFormGroup {
          title
          fields {
            firstNameLabel
            lastNameLabel
            occupationLabel
            locationLabel
            emailLabel
            phoneLabel
            messageLabel
            submitLabel
          }
        }
      }
    }
  }
`;

export type ContactRow = {
  /** WP may return a string or a list, e.g. `["address"]`. */
  icon?: string | string[] | null;
  text?: string | null;
};

export type ContactBlock = {
  title?: string | null;
  contacts?: ContactRow | ContactRow[] | null;
};

export type ContactSupportGroup = {
  title?: string | null;
  blocks?: ContactBlock | ContactBlock[] | null;
};

export type ContactFormFields = {
  firstNameLabel?: string | null;
  lastNameLabel?: string | null;
  occupationLabel?: string | null;
  locationLabel?: string | null;
  emailLabel?: string | null;
  phoneLabel?: string | null;
  messageLabel?: string | null;
  submitLabel?: string | null;
};

export type ContactFormGroup = {
  title?: string | null;
  fields?: ContactFormFields | null;
};

export type ContactPageData = {
  page?: {
    title?: string | null;
    contactUsSettings?: {
      contactUsSupportGroup?: ContactSupportGroup | null;
      contactUsFormGroup?: ContactFormGroup | null;
    } | null;
  } | null;
};

export type ContactSupportIconKind = "address" | "phone" | "fax" | "email";

export type ContactSupportCard = {
  title: string;
  rows: { iconKind: ContactSupportIconKind | null; text: string }[];
};

function asArray<T>(x: T | T[] | null | undefined): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

function parseContactIcon(
  raw: string | string[] | null | undefined,
): ContactSupportIconKind | null {
  let slug: string | null = null;
  if (raw == null) return null;
  if (Array.isArray(raw)) {
    const first = raw.find((x) => typeof x === "string" && String(x).trim());
    slug = first != null ? String(first).trim() : null;
  } else if (typeof raw === "string") {
    slug = raw.trim() || null;
  }
  if (
    slug === "address" ||
    slug === "phone" ||
    slug === "fax" ||
    slug === "email"
  ) {
    return slug;
  }
  return null;
}

export function contactRowHasMailtoLink(html: string): boolean {
  return /<a\b[^>]*\bhref\s*=\s*["']mailto:/i.test(html.trim());
}

export function contactRowHasTelLink(html: string): boolean {
  return /<a\b[^>]*\bhref\s*=\s*["']tel:/i.test(html.trim());
}

export function contactRowMailtoHref(html: string): string | null {
  const trimmed = html.trim();
  if (!trimmed) return null;

  const fromAttr = trimmed.match(/href\s*=\s*["']mailto:([^"']+)["']/i);
  if (fromAttr?.[1]) {
    try {
      return decodeURIComponent(fromAttr[1].trim());
    } catch {
      return fromAttr[1].trim();
    }
  }

  const stripped = trimmed
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const m = stripped.match(/[^\s<>'"()[\]]+@[^\s<>'"()[\]]+\.[^\s<>'"()[\]]+/);
  if (!m) return null;
  return m[0].replace(/^[,;:<(]+|[,;:)>.\]]+$/g, "") || null;
}

export function contactRowTelHref(html: string): string | null {
  const trimmed = html.trim();
  if (!trimmed) return null;

  const fromAttr = trimmed.match(/href\s*=\s*["']tel:([^"']+)["']/i);
  if (fromAttr?.[1]) {
    try {
      return decodeURIComponent(fromAttr[1].trim());
    } catch {
      return fromAttr[1].trim();
    }
  }

  const stripped = trimmed
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const m = stripped.match(/\+?\d[\d\s().-]{5,}\d/);
  if (!m) return null;

  const normalized = m[0].replace(/[^\d+]/g, "");
  const digitsOnly = normalized.replace(/\D/g, "");
  if (digitsOnly.length < 7) return null;
  return normalized;
}

export function normalizeContactSupportCards(
  group: ContactSupportGroup | null | undefined,
): ContactSupportCard[] {
  const blocks = asArray(group?.blocks);
  const out: ContactSupportCard[] = [];
  for (const block of blocks) {
    const title = (block?.title ?? "").trim();
    const contacts = asArray(block?.contacts).map((c) => ({
      iconKind: parseContactIcon(c?.icon),
      text: (c?.text ?? "").trim(),
    }));
    const rows = contacts.filter((r) => r.text);
    if (!title && rows.length === 0) continue;
    out.push({
      title: title || "Contact",
      rows,
    });
  }
  return out;
}
