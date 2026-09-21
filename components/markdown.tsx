import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

const components: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  ),
  // Task-list checkboxes are read-only in the timeline.
  input: (props) => <input {...props} disabled className="mr-1 align-middle accent-primary" />,
};

/**
 * Renders a log entry. GitHub-flavoured Markdown (lists, bold, code, tables,
 * task lists, ~~strike~~), bare URLs auto-linked. Raw HTML is never rendered.
 */
export function Markdown({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("prose prose-sm max-w-none dark:prose-invert", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} skipHtml>
        {text}
      </ReactMarkdown>
    </div>
  );
}
