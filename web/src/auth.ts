import NextAuth from "next-auth";
import authConfig from "@/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (user.email && account?.providerAccountId) {
        const { upsertUserFromOAuth } = await import("@/lib/dynamodb/repositories/users");
        try {
          await upsertUserFromOAuth({
            email: user.email,
            name: user.name,
            sub: account.providerAccountId,
          });
        } catch {
          /* dev without DB */
        }
      }
      return true;
    },
  },
});
