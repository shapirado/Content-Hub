import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

/** Small hardcoded team allow-list, e.g. AUTH_USERS="you@x.com:pw1,nirit@x.com:pw2" */
function allowedUsers(): { email: string; password: string }[] {
  const raw = process.env.AUTH_USERS ?? "";
  return raw
    .split(",")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [email, password] = pair.split(":");
      return { email: email?.trim() ?? "", password: password ?? "" };
    })
    .filter((u) => u.email && u.password);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        const match = allowedUsers().find(
          (u) => u.email.toLowerCase() === email && u.password === password
        );
        return match ? { id: match.email, email: match.email } : null;
      },
    }),
  ],
});
