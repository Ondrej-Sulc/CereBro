import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support CereBro - Donate",
  description:
    "Support CereBro with a monthly subscription or one-time donation to help cover hosting and ongoing development.",
};

export default function SupportLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
