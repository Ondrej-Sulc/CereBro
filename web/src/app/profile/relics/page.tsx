import { redirect } from "next/navigation";

export default function LegacyPlayerRelicsPage() {
  redirect("/relics?view=personal");
}
