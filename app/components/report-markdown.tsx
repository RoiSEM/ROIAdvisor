import Markdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

function safeReportUrl(value: string): string {
  const href = defaultUrlTransform(value);
  if (!href || href.startsWith("//") || href.includes("\\") || Array.from(href).some(char => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127)) return "";
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(href);
  if (hasScheme && !/^(?:https?:\/\/|mailto:)/i.test(href)) return "";
  try {
    const url = new URL(href, "https://convert.invalid/");
    if (!["https:", "http:", "mailto:"].includes(url.protocol) || url.username || url.password) return "";
    return href;
  } catch {
    return "";
  }
}

/** Untrusted report content is rendered as React nodes, never raw HTML. */
export default function ReportMarkdown({
  markdown,
  className,
}: {
  markdown: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        allowedElements={[
          "p", "br", "strong", "em", "del", "a", "ul", "ol", "li", "blockquote",
          "pre", "code", "h1", "h2", "h3", "h4", "h5", "h6", "hr",
          "table", "thead", "tbody", "tr", "th", "td",
        ]}
        urlTransform={safeReportUrl}
        components={{
          a: ({ href, title, children }) => href
            ? <a href={href} title={title} rel="noopener noreferrer nofollow">{children}</a>
            : <span>{children}</span>,
        }}
      >{markdown}</Markdown>
    </div>
  );
}
