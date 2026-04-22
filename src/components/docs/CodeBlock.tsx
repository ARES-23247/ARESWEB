import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

export const CodeBlock = ({ language, value, ...props }: { language?: string; value: string; [key: string]: unknown }) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="relative group my-4">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-2 bg-obsidian/80 hover:bg-obsidian text-marble/40 hover:text-white ares-cut-sm opacity-0 group-hover:opacity-100 transition-all z-10 backdrop-blur-sm shadow-md border border-white/10"
        aria-label="Copy code"
      >
        {isCopied ? <Check size={14} className="text-ares-cyan" /> : <Copy size={14} />}
      </button>
      <SyntaxHighlighter
        style={vscDarkPlus as unknown as { [key: string]: React.CSSProperties }}
        language={language || 'text'}
        PreTag="div"
        className="ares-cut-sm text-sm font-mono overflow-x-auto !bg-obsidian border border-white/8 shadow-lg !my-0"
        showLineNumbers={true}
        {...props}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
};
