import {
  normalizeSingleTemplateOptionalItems,
  normalizeSupportLinks,
  relatedPartsHtmlFromApi,
  type ProductPageData,
  type ProductPageMediaNode,
} from "./queries/product-detail";

export type ProductPageView = {
  title: string;
  /** ACF Product Images → Main */
  mainImg: ProductPageMediaNode | undefined;
  brandImg: ProductPageMediaNode | undefined;
  specHtml: string;
  specSectionTitle: string;
  relatedPartsTitle: string;
  relatedPartsHtml: string;
  showRelatedSection: boolean;
  supportHeading: string;
  supportLinks: ReturnType<typeof normalizeSupportLinks>;
  showSupportAccordion: boolean;
  showSpecAccordion: boolean;
  showProductAccordion: boolean;
  optionalItems: ReturnType<typeof normalizeSingleTemplateOptionalItems>;
};

export function buildProductPageView(
  product: ProductPageData["product"] | null,
  ctx: { slug: string; catalogTitle: string },
): ProductPageView {
  const { slug, catalogTitle: catalogTitleProp } = ctx;
  const title =
    product?.title?.trim() ||
    catalogTitleProp.trim() ||
    (slug ? slug.replace(/-/g, " ") : "Product");

  const images = product?.productSettings?.productImagesGroup;
  const mainImg = images?.productImagesMain?.node;
  const brandImg = images?.productImagesBrand?.node;
  const specGroup = product?.productSettings?.productSpecificationGroup;
  const specHtml = specGroup?.productSpecification?.trim() ?? "";
  const specSectionTitle = "Specifications";
  const relatedPartsGroup = product?.productSettings?.productRelatedPartsGroup;
  const relatedPartsTitle = "Replacement Parts";
  const relatedPartsHtml = relatedPartsHtmlFromApi(
    relatedPartsGroup?.relatedParts,
  );
  const showRelatedSection = Boolean(relatedPartsHtml);
  const supportGroup = product?.productSettings?.productSupportGroup;
  const supportHeading = "Technical Support";
  const supportLinks = normalizeSupportLinks(
    supportGroup?.productSupportLinks ?? null,
  );
  const showSupportAccordion = supportLinks.length > 0;
  const showSpecAccordion = Boolean(specHtml);
  const showProductAccordion =
    showSpecAccordion || showSupportAccordion || showRelatedSection;
  const optionalItems = normalizeSingleTemplateOptionalItems(
    product?.productSettings?.singleTemplateGroup?.singleTemplateOptional,
  );

  return {
    title,
    mainImg,
    brandImg,
    specHtml,
    specSectionTitle,
    relatedPartsTitle,
    relatedPartsHtml,
    showRelatedSection,
    supportHeading,
    supportLinks,
    showSupportAccordion,
    showSpecAccordion,
    showProductAccordion,
    optionalItems,
  };
}
