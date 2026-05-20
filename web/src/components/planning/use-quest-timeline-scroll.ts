"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useQuestTimelineScroll({
    setShowVideoId,
    setIsTeamExpanded,
}: {
    setShowVideoId: (id: string | null) => void;
    setIsTeamExpanded: (updater: (previous: boolean) => boolean) => void;
}) {
    const headerRef = useRef<HTMLDivElement>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            if (!headerRef.current) return;
            const rect = headerRef.current.getBoundingClientRect();
            setIsScrolled(rect.top <= 69);
        };
        window.addEventListener("scroll", handleScroll, { passive: true });
        handleScroll();
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const getStickyOffset = useCallback(() => {
        const stickyTeam = document.querySelector("[data-sticky-team]");
        return stickyTeam
            ? stickyTeam.getBoundingClientRect().bottom + 12
            : (window.matchMedia("(min-width: 768px)").matches ? 130 : 70);
    }, []);

    const scrollToCard = useCallback((id: string, delay = 0) => {
        const doScroll = () => {
            const element = document.getElementById(`encounter-${id}`);
            if (!element) return;
            const offset = getStickyOffset();
            const rect = element.getBoundingClientRect();
            window.scrollTo({ top: window.scrollY + rect.top - offset, behavior: "smooth" });
        };
        if (delay > 0) {
            setTimeout(doScroll, delay);
        } else {
            requestAnimationFrame(doScroll);
        }
    }, [getStickyOffset]);

    const toggleExpand = useCallback((id: string) => {
        const isOpening = expandedId !== id;
        if (isOpening) {
            setShowVideoId(null);
            const newElement = document.getElementById(`encounter-${id}`);
            if (newElement) {
                const offset = getStickyOffset();
                const newRect = newElement.getBoundingClientRect();
                let targetScroll = window.scrollY + newRect.top - offset;

                if (expandedId) {
                    const oldElement = document.getElementById(`encounter-${expandedId}`);
                    if (oldElement) {
                        const oldRect = oldElement.getBoundingClientRect();
                        if (oldRect.top < newRect.top) {
                            const headerEl = oldElement.querySelector<HTMLElement>('[role="button"]');
                            const collapsedHeight = headerEl ? headerEl.getBoundingClientRect().height : 100;
                            const delta = Math.max(0, oldRect.height - collapsedHeight);
                            targetScroll -= delta;
                        }
                    }
                }

                window.scrollTo({ top: Math.max(0, targetScroll), behavior: "instant" });
            }
        }
        setExpandedId(prev => prev === id ? null : id);
    }, [expandedId, getStickyOffset, setShowVideoId]);

    const scrollToEncounter = useCallback((id: string) => {
        setExpandedId(id);
        setIsTeamExpanded(() => false);
        scrollToCard(id, 100);
    }, [scrollToCard, setIsTeamExpanded]);

    const closeEncounterAfterSelection = useCallback((id: string) => {
        const element = document.getElementById(`encounter-${id}`);
        if (element) {
            const offset = getStickyOffset();
            const rect = element.getBoundingClientRect();
            window.scrollTo({ top: window.scrollY + rect.top - offset, behavior: "instant" });
        }
        setExpandedId(null);
    }, [getStickyOffset]);

    return {
        headerRef,
        expandedId,
        isScrolled,
        toggleExpand,
        scrollToEncounter,
        closeEncounterAfterSelection,
    };
}
