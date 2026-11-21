"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Suggestion = { id: string; name: string; group: string; color: string };

export function AllianceMemberSearch({ value, suggestions, inputRef, onChange, onSelect }: {
    value: string;
    suggestions: Suggestion[];
    inputRef: RefObject<HTMLInputElement | null>;
    onChange: (value: string) => void;
    onSelect: (suggestion: Suggestion) => void;
}) {
    const listId = useId();
    const listRef = useRef<HTMLUListElement>(null);
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const expanded = open && suggestions.length > 0;
    const activeId = expanded && suggestions[activeIndex] ? listId + "-" + activeIndex : undefined;

    useEffect(() => {
        if (activeId) listRef.current?.children[activeIndex]?.scrollIntoView?.({ block: "nearest" });
    }, [activeId, activeIndex]);

    const close = () => {
        setOpen(false);
        setActiveIndex(-1);
    };
    const select = (suggestion: Suggestion) => {
        inputRef.current?.focus();
        onSelect(suggestion);
        close();
    };
    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.nativeEvent.isComposing || event.keyCode === 229) return;
        if (event.key === "Escape" && expanded) {
            event.preventDefault();
            close();
        } else if (suggestions.length && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
            event.preventDefault();
            setOpen(true);
            const last = suggestions.length - 1;
            setActiveIndex(index => event.key === "ArrowDown" ? (index + 1) % suggestions.length : index <= 0 || index > last ? last : index - 1);
        } else if (event.key === "Enter" && expanded) {
            event.preventDefault();
            select(suggestions[activeIndex] ?? suggestions[0]);
        }
    };

    return (
        <div className="relative min-w-0 flex-1 xl:w-56" onBlur={event => {
            if (!event.currentTarget.contains(event.relatedTarget)) close();
        }}>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <Input
                ref={inputRef}
                role="combobox"
                aria-label="Find a member"
                aria-autocomplete="list"
                aria-expanded={expanded}
                aria-controls={expanded ? listId : undefined}
                aria-activedescendant={activeId}
                autoComplete="off"
                spellCheck={false}
                placeholder="Find a member…"
                value={value}
                onFocus={() => setOpen(true)}
                onClick={() => setOpen(true)}
                onChange={event => {
                    onChange(event.target.value);
                    setActiveIndex(-1);
                    setOpen(true);
                }}
                onKeyDown={handleKeyDown}
                className="h-10 rounded-lg border-slate-700/80 bg-slate-900/65 pl-9 pr-9 placeholder:text-slate-400 focus-visible:ring-indigo-400"
            />
            {value && (
                <Button type="button" variant="ghost" size="icon" aria-label="Clear member search" onClick={() => {
                    onChange("");
                    inputRef.current?.focus();
                    close();
                }} className="absolute right-1 top-1/2 size-8 -translate-y-1/2 text-slate-400 hover:text-white">
                    <X aria-hidden="true" />
                </Button>
            )}
            {expanded && (
                <ul id={listId} ref={listRef} role="listbox" aria-label="Matching alliance members"
                    className="absolute inset-x-0 top-full z-30 mt-2 max-h-64 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-1.5 shadow-xl shadow-black/40 sm:min-w-64">
                    {suggestions.map((suggestion, index) => (
                        <li
                            key={suggestion.id}
                            id={listId + "-" + index}
                            role="option"
                            aria-selected={activeIndex === index}
                            onMouseDown={event => event.preventDefault()}
                            onPointerMove={event => { if (event.pointerType === "mouse") setActiveIndex(index); }}
                            onClick={() => select(suggestion)}
                            className={cn("flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm text-slate-100", activeIndex === index && "bg-indigo-400/15")}
                        >
                            <span className="min-w-0 truncate font-medium">{suggestion.name}</span>
                            <span className="flex shrink-0 items-center gap-1.5 text-xs text-slate-400">
                                <span aria-hidden="true" className="size-1.5 rounded-full" style={{ backgroundColor: suggestion.color }} />
                                {suggestion.group}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
