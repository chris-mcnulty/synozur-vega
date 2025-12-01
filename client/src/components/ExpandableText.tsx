import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface ExpandableTextProps {
  text: string;
  maxLines?: number;
  className?: string;
}

export function ExpandableText({ text, maxLines = 4, className = "" }: ExpandableTextProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const lineHeight = 1.5;
  const maxHeight = `${maxLines * lineHeight}em`;
  
  const needsTruncation = text.length > 150;

  if (!needsTruncation) {
    return <p className={className}>{text}</p>;
  }

  return (
    <div className="relative">
      <div
        className={`overflow-hidden transition-all duration-200 ${className}`}
        style={{ 
          maxHeight: isExpanded ? "none" : maxHeight,
          lineHeight: lineHeight
        }}
      >
        {text}
      </div>
      {!isExpanded && (
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-card to-transparent pointer-events-none" />
      )}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 mt-1 font-medium"
        data-testid="button-expand-text"
      >
        {isExpanded ? (
          <>
            Show less <ChevronUp className="h-3 w-3" />
          </>
        ) : (
          <>
            Show more <ChevronDown className="h-3 w-3" />
          </>
        )}
      </button>
    </div>
  );
}
