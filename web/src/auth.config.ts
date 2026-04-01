import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

function buildProviders() {
  const list: NextAuthConfig["providers"] = [];

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    list.push(
      Google({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      }),
    );
  }

  if (process.env.AUTH_EMAIL && process.env.AUTH_PASSWORD) {
    list.push(
      Credentials({
        id: "credentials",
        name: "Email & Password",
        credentials: {
          email: { label: "メールアドレス", type: "email" },
          password: { label: "パスワード", type: "password" },
        },
        async authorize(credentials) {
          const allowedEmail = process.env.AUTH_EMAIL!;
          const storedPassword = process.env.AUTH_PASSWORD!;
          const email = credentials?.email as string | undefined;
          const password = credentials?.password as string | undefined;
          if (!email || !password) return null;
          if (email.toLowerCase() !== allowedEmail.toLowerCase()) return null;

          let ok = false;
          if (storedPassword.startsWith("$2")) {
            const { default: bcrypt } = await import("bcryptjs");
            ok = await bcrypt.compare(password, storedPassword);
          } else {
            ok = password === storedPassword;
          }
          if (!ok) return null;

          return {
            id: email.toLowerCase(),
            email: allowedEmail,
            name: allowedEmail.split("@")[0],
          };
        },
      }),
    );
  }

  if (process.env.NIS_DEV_BYPASS_AUTH === "1") {
    list.push(
      Credentials({
        id: "dev-bypass",
        name: "Dev Bypass",
        credentials: {},
        async authorize() {
          return {
            id: "dev-local-user",
            email: "dev@nis.local",
            name: "Dev User",
          };
        },
      }),
    );
  }

  return list;
}

export default {
  trustHost: true,
  providers: buildProviders(),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.email) token.email = user.email;
      if (user?.name) token.name = user.name;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      if (session.user && token.email) {
        session.user.email = token.email as string;
      }
      if (session.user && token.name) {
        session.user.name = token.name as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
