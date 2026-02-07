import { DefaultSession } from "next-auth"

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      /** The user's Discord ID. */
      discordId?: string
      /** Whether the user is a Bot Admin. */
      isBotAdmin: boolean
    } & DefaultSession["user"]
  }
}
