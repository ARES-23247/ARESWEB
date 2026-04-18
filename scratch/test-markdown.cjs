import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { renderToString } from "react-dom/server";

const md = `
# Architecture Diagrams

These diagrams help you understand how ARESLib's components interact and how data flows through the system.

## Core Architecture Overview

<swervesimulator />

Some generic text

<CodePlayground />
`;

const res = renderToString(
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    rehypePlugins={[rehypeRaw]}
    components={{
      h1: ({ children }) => <h1 className="test-h1">{children}</h1>,
      swervesimulator: () => <div className="sim">SIM_WORKS</div>,
      codeplayground: () => <div className="sim2">CODE_WORKS</div>,
    }}
  >
    {md}
  </ReactMarkdown>
);

console.log(res);
