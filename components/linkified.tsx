import { Fragment } from "react";

const URL_RE = /(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g;

/** Plain text, preserved whitespace, URLs clickable. Markdown rendering is a v2 item. */
export function Linkified({ text, className }: { text: string; className?: string }) {
  const parts = text.split(URL_RE);
  return (
    <p className={className ?? "whitespace-pre-wrap break-words"}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary underline underline-offset-4 hover:opacity-80"
          >
            {part.replace(/^https?:\/\//, "")}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </p>
  );
}
