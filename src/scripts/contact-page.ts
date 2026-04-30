import {
  hidePageErrorToast,
  installPageErrorToast,
  showPageErrorToast,
} from "../lib/page-error-toast";
import {
  initFormCustomSelects,
  syncAllCustomSelectsFromNative,
} from "./custom-select";

const NETWORK_ERROR_TOAST =
  "Network error. Check your connection and try again.";

type SubmitPayload = {
  success?: boolean | null;
  status?: string | null;
  message?: string | null;
  invalidFields?: Array<{
    field?: string | null;
    message?: string | null;
  }> | null;
};

const SUBMIT_CONTACT_MUTATION = /* GraphQL */ `
  mutation SubmitContact($input: SubmitContactForm7Input!) {
    submitContactForm7(input: $input) {
      success
      status
      message
      invalidFields {
        field
        message
      }
    }
  }
`;

type GraphqlSubmitResponse = {
  data?: { submitContactForm7?: SubmitPayload | null };
  errors?: Array<{ message?: string }>;
};

function clearFieldErrors(root: HTMLElement): void {
  root.querySelectorAll("[data-field-error]").forEach((el) => {
    const p = el as HTMLElement;
    p.textContent = "";
    p.hidden = true;
  });
  root.querySelectorAll(".is-invalid").forEach((el) => {
    el.classList.remove("is-invalid");
  });
}

function showFieldError(
  root: HTMLElement,
  field: string,
  message: string,
): void {
  const err = root.querySelector(`[data-field-error="${CSS.escape(field)}"]`);
  if (err instanceof HTMLElement) {
    err.textContent = message;
    err.hidden = false;
  }
  const wrap = root.querySelector(`[data-field="${CSS.escape(field)}"]`);
  wrap?.classList.add("is-invalid");
}

function readEntries(
  form: HTMLFormElement,
): Array<{ name: string; value: string }> {
  const fd = new FormData(form);
  const names = [
    "first_name",
    "last_name",
    "occupation",
    "location",
    "email",
    "phone",
    "message",
  ] as const;
  return names.map((name) => ({
    name,
    value: String(fd.get(name) ?? "").trim(),
  }));
}

function clientValidate(
  root: HTMLElement,
  entries: Array<{ name: string; value: string }>,
): boolean {
  clearFieldErrors(root);
  let ok = true;
  const req = ["first_name", "last_name", "email", "phone", "message"] as const;
  for (const name of req) {
    const row = entries.find((e) => e.name === name);
    if (!row?.value) {
      showFieldError(root, name, "This field is required.");
      ok = false;
    }
  }
  const email = entries.find((e) => e.name === "email")?.value ?? "";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showFieldError(root, "email", "Enter a valid email address.");
    ok = false;
  }
  return ok;
}

async function init(): Promise<void> {
  const root = document.querySelector<HTMLElement>("[data-contact-page]");
  const form = document.querySelector<HTMLFormElement>("[data-contact-form]");
  const submitBtn = document.querySelector<HTMLButtonElement>(
    "[data-contact-submit]",
  );
  const statusEl = document.getElementById("contact-form-status");
  const errorToast = document.getElementById("contact-page-error-toast");
  if (!root || !form || !submitBtn || !statusEl) return;

  if (errorToast instanceof HTMLElement) {
    installPageErrorToast(errorToast);
  }

  initFormCustomSelects(form);

  const clearSingleFieldError = (field: string): void => {
    const wrap = form.querySelector(`[data-field="${CSS.escape(field)}"]`);
    wrap?.classList.remove("is-invalid");
    const err = form.querySelector(`[data-field-error="${CSS.escape(field)}"]`);
    if (err instanceof HTMLElement) {
      err.textContent = "";
      err.hidden = true;
    }
  };

  const resolveFieldFromEl = (el: Element): string | null => {
    if (!(el instanceof HTMLElement)) return null;
    return (
      el.getAttribute("data-field") ??
      el.closest("[data-custom-select-root]")?.getAttribute("data-field") ??
      null
    );
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    statusEl.textContent = "";
    statusEl.hidden = true;
    statusEl.classList.remove("is-success", "is-error");
    hidePageErrorToast(errorToast instanceof HTMLElement ? errorToast : null);
    clearFieldErrors(root);

    const entries = readEntries(form);
    if (!clientValidate(root, entries)) return;

    submitBtn.disabled = true;
    try {
      const res = await fetch("/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: SUBMIT_CONTACT_MUTATION,
          variables: {
            input: {
              formSlug: "contact-form",
              fieldEntries: entries,
            },
          },
        }),
      });
      const json = (await res.json()) as GraphqlSubmitResponse & {
        message?: string;
      };

      const gqlErr =
        json.errors
          ?.map((e) => e.message)
          .filter(Boolean)
          .join(" ") ?? "";

      if (!res.ok) {
        statusEl.textContent =
          gqlErr ||
          json.message ||
          `Request failed (${res.status}). Please try again later.`;
        statusEl.classList.add("is-error");
        statusEl.hidden = false;
        return;
      }

      if (json.errors?.length) {
        statusEl.textContent =
          gqlErr || "Something went wrong. Please try again later.";
        statusEl.classList.add("is-error");
        statusEl.hidden = false;
        return;
      }

      const result = json.data?.submitContactForm7 ?? null;
      if (result?.success) {
        statusEl.textContent =
          (result.message && result.message.trim()) ||
          "Thank you — your message has been sent.";
        statusEl.classList.add("is-success");
        statusEl.hidden = false;
        form.reset();
        syncAllCustomSelectsFromNative(form);
        return;
      }

      const invalid = result?.invalidFields ?? [];
      if (invalid.length) {
        for (const row of invalid) {
          const f = (row.field ?? "").trim();
          const msg = (row.message ?? "").trim() || "Invalid value.";
          if (f) showFieldError(root, f, msg);
        }
        statusEl.textContent =
          (result?.message && result.message.trim()) ||
          "Please fix the highlighted fields.";
        statusEl.classList.add("is-error");
        statusEl.hidden = false;
        return;
      }

      statusEl.textContent =
        (result?.message && result.message.trim()) ||
        "Could not send the message. Please try again.";
      statusEl.classList.add("is-error");
      statusEl.hidden = false;
    } catch {
      showPageErrorToast(
        errorToast instanceof HTMLElement ? errorToast : null,
        NETWORK_ERROR_TOAST,
      );
    } finally {
      submitBtn.disabled = false;
    }
  });

  form.querySelectorAll("input, textarea").forEach((el) => {
    const onInteract = (): void => {
      const field = resolveFieldFromEl(el);
      if (!field) return;
      clearSingleFieldError(field);
    };
    el.addEventListener("input", onInteract);
    el.addEventListener("change", onInteract);
  });
  form.querySelectorAll("[data-custom-select-native]").forEach((el) => {
    el.addEventListener("change", () => {
      const field = resolveFieldFromEl(el);
      if (!field) return;
      clearSingleFieldError(field);
    });
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void init());
} else {
  void init();
}
