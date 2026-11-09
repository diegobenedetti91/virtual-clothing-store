import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { authConfig } from "./auth.config";
import { isRateLimited } from "./rateLimit";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) return null;

          // Brute-force protection on the admin login (per account)
          const emailKey = String(credentials.email).toLowerCase();
          if (isRateLimited(`admin-login:${emailKey}`, 10, 15 * 60 * 1000)) {
            console.warn("[auth] too many login attempts");
            return null;
          }

          const user = await prisma.adminUser.findUnique({
            where: { email: credentials.email as string },
          });

          if (!user) {
            console.error("[auth] user not found");
            return null;
          }

          const isValid = await bcrypt.compare(
            credentials.password as string,
            user.password
          );

          if (!isValid) {
            console.error("[auth] wrong password");
            return null;
          }

          return { id: user.id, email: user.email, name: user.name };
        } catch (err) {
          console.error("[auth] authorize error:", err);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.email = token.email as string;
        session.user.name = token.name as string;
      }
      return session;
    },
  },
});
