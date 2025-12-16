"use client";

import { usePathname } from "next/navigation";
import Footer from "@/components/Footer";

export default function ConditionalFooter() {
  const pathname = usePathname();
  const isPlanningPage = pathname?.startsWith("/planning");

  if (isPlanningPage) {
    return null;
  }

  return <Footer />;
}
