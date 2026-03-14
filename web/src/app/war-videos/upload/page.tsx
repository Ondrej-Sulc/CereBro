import type { Metadata } from "next";
import { Suspense } from 'react';
import UploadPageClient from './UploadPageClient';

export const metadata: Metadata = {
  title: "Upload Alliance War Video - CereBro",
  description:
    "Submit your MCOC Alliance War video and fight details using a secure upload link.",
};

function Loading() {
  return <p className="text-center text-muted-foreground">Loading form...</p>;
}

export default function UploadWarVideoPage() {
  return (
    <Suspense fallback={<Loading />}>
      <UploadPageClient />
    </Suspense>
  );
}
