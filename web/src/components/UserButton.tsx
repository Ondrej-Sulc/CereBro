import { auth } from "@/auth";
import { UserMenu } from "./UserMenu";

export async function UserButton() {
  const session = await auth();
  return <UserMenu user={session?.user} />;
}
