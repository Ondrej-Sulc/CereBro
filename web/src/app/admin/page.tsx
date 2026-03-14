import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Dashboard - CereBro",
  description:
    "Overview of the CereBro admin portal and quick access to administrative tools.",
};

export default function AdminDashboardPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-muted-foreground">Welcome to the CereBro Admin Portal.</p>
    </div>
  )
}
