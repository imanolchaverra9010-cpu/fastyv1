import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  absoluteUrl,
  getSeoForPath,
  type SeoConfig,
} from "@/lib/seo";

type SeoHeadProps = {
  override?: Partial<SeoConfig>;
};

const upsertMeta = (selector: string, attr: "name" | "property", key: string, content: string) => {
  let el = document.head.querySelector<HTMLMetaElement>(`${selector}[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
};

const upsertLink = (rel: string, href: string) => {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
};

export function SeoHead({ override }: SeoHeadProps) {
  const { pathname } = useLocation();

  useEffect(() => {
    const base = getSeoForPath(pathname);
    const seo = { ...base, ...override };
    const canonicalPath = seo.path || pathname;
    const canonical = absoluteUrl(canonicalPath);
    const robots = seo.index === false ? "noindex, nofollow" : "index, follow";

    document.title = seo.title;

    upsertMeta("meta", "name", "description", seo.description);
    upsertMeta("meta", "name", "robots", robots);
    upsertMeta("meta", "property", "og:title", seo.title);
    upsertMeta("meta", "property", "og:description", seo.description);
    upsertMeta("meta", "property", "og:url", canonical);
    upsertMeta("meta", "property", "og:site_name", SITE_NAME);
    upsertMeta("meta", "property", "og:type", "website");
    upsertMeta("meta", "property", "og:image", DEFAULT_OG_IMAGE);
    upsertMeta("meta", "name", "twitter:card", "summary_large_image");
    upsertMeta("meta", "name", "twitter:title", seo.title);
    upsertMeta("meta", "name", "twitter:description", seo.description);
    upsertMeta("meta", "name", "twitter:image", DEFAULT_OG_IMAGE);
    upsertLink("canonical", canonical);
  }, [pathname, override?.title, override?.description, override?.index, override?.path]);

  return null;
}

export default SeoHead;
