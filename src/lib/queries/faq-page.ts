/** FAQ page (WordPress URI: /resources/faq/) */

export const FAQ_PAGE_URI = "/resources/faq/";

export const FAQ_PAGE_QUERY = /* GraphQL */ `
  query FaqPage($id: ID!) {
    page(id: $id, idType: URI) {
      title
      faqPageContent {
        sidebarSectionTitle
        questionsAnswers {
          questionsAnswersSection {
            category
            questions {
              question
              answers {
                answer
              }
            }
          }
        }
      }
    }
  }
`;

export type FaqAnswerRow = {
  answer?: string | null;
};

export type FaqQuestionRow = {
  question?: string | null;
  answers?: FaqAnswerRow | FaqAnswerRow[] | null;
};

export type FaqSectionRow = {
  category?: string | null;
  questions?: FaqQuestionRow | FaqQuestionRow[] | null;
};

export type FaqQuestionsAnswersBlock = {
  questionsAnswersSection?: FaqSectionRow | FaqSectionRow[] | null;
};

export type FaqPageContent = {
  sidebarSectionTitle?: string | null;
  questionsAnswers?:
    | FaqQuestionsAnswersBlock
    | FaqQuestionsAnswersBlock[]
    | null;
};

export type FaqPageData = {
  page?: {
    title?: string | null;
    faqPageContent?: FaqPageContent | null;
  } | null;
};

export type FaqQuestion = {
  question: string;
  answerHtml: string;
};

export type FaqSection = {
  category: string;
  questions: FaqQuestion[];
};

function asArray<T>(x: T | T[] | null | undefined): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

function normalizeAnswers(answers: FaqAnswerRow | FaqAnswerRow[] | null | undefined): string {
  const rows = asArray(answers);
  const parts = rows
    .map((r) => (typeof r?.answer === "string" ? r.answer.trim() : ""))
    .filter(Boolean);
  return parts.join("\n");
}

export function normalizeFaqSections(
  content: FaqPageContent | null | undefined,
): FaqSection[] {
  const qaRoot = content?.questionsAnswers;
  if (!qaRoot) return [];
  const qaBlocks = asArray(qaRoot);

  const out: FaqSection[] = [];
  for (const qa of qaBlocks) {
    const rawSections = qa?.questionsAnswersSection;
    const sectionRows = asArray(rawSections);
    for (const row of sectionRows) {
      const cat = (row?.category ?? "").trim();
      if (!cat) continue;
      const qRows = asArray(row?.questions);
      const questions: FaqQuestion[] = [];
      for (const q of qRows) {
        const question = (q?.question ?? "").trim();
        if (!question) continue;
        const answerHtml = normalizeAnswers(q?.answers);
        questions.push({ question, answerHtml });
      }
      if (questions.length > 0) {
        out.push({ category: cat, questions });
      }
    }
  }
  return out;
}

export function faqCategoryAnchorId(category: string): string {
  const slug = category
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "");
  return `faq-${slug || "section"}`;
}
