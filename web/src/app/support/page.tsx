import type { Metadata } from "next";
import SupportPageClient from "./SupportPageClient";

export const metadata: Metadata = {
  title: "Support CereBro - Donate",
  description: "Support CereBro with a one-time donation to help cover hosting and ongoing development.",
};

export default function SupportPage() {
  return <SupportPageClient />;
}
