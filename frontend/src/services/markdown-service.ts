import DOMPurify from "dompurify";
import { marked } from "marked";

marked.setOptions({
  gfm: true,
  breaks: true,
});

export function renderMarkdown(input: string): string {
  const html = marked.parse(input || "") as string;
  return DOMPurify.sanitize(html);
}
