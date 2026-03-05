import React from 'react';

/**
 * A very simple and lightweight parser for basic markdown elements often used in tips:
 * - Bold: **text**
 * - Italic: *text* or _text_
 * - Bullet points: - text or * text at the start of a line
 * - Newlines
 */
export function SimpleMarkdown({ content, className }: { content: string, className?: string }) {
    if (!content) return null;

    // Split by lines to handle lists
    const lines = content.split('\n');

    return (
        <div className={`space-y-1.5 ${className || ''}`}>
            {lines.map((line, lineIndex) => {
                const isBullet = line.trim().startsWith('- ') || line.trim().startsWith('* ');
                const cleanLine = isBullet ? line.trimStart().replace(/^[-*]\s+/, '') : line;

                // If it's empty, skip or render a spacer
                if (!line.trim()) {
                    return <div key={`empty-${lineIndex}`} className="h-1" />;
                }

                // Parse bold and italics
                // **bold**
                const parts = cleanLine.split(/(\*\*.*?\*\*|\*.*?\*|_.*?_)/g);

                const renderedParts = parts.map((part, partIndex) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                        return <strong key={partIndex} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
                    } else if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
                        return <em key={partIndex} className="italic text-slate-300">{part.slice(1, -1)}</em>;
                    }
                    return <span key={partIndex}>{part}</span>;
                });

                if (isBullet) {
                    return (
                        <div key={lineIndex} className="flex items-start gap-2">
                            <span className="text-slate-500 mt-1 flex-shrink-0">•</span>
                            <div className="flex-1">{renderedParts}</div>
                        </div>
                    );
                }

                return (
                    <div key={lineIndex}>
                        {renderedParts}
                    </div>
                );
            })}
        </div>
    );
}
