import SupportPageClient from "./SupportPageClient";
import { auth } from "@/auth";

export default async function SupportPage() {
  const session = await auth();
  return <SupportPageClient isLoggedIn={!!session?.user} />;
}
