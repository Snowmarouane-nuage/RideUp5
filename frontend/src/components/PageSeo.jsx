import { useLocation } from "react-router-dom";
import { usePageSeo } from "@/lib/seo";

/** Met à jour title, meta description, Open Graph et JSON-LD selon la route. */
export default function PageSeo() {
  const { pathname } = useLocation();
  usePageSeo(pathname);
  return null;
}
