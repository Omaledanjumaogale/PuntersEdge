import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { ConvexError } from "convex/values";

/**
 * Email + password accounts. Sign-up also collects a display name.
 * Client calls: auth:signIn { provider: "password", params: { email, password, flow, name? } }
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params): { email: string } & Record<string, string> {
        const email = String(params.email ?? "").trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          throw new ConvexError("Enter a valid email address.");
        }
        const name = String(params.name ?? "").trim().slice(0, 40);
        return name ? { email, name } : { email };
      },
      validatePasswordRequirements(password: string) {
        if (password.length < 8 || !/\d/.test(password) || !/[a-zA-Z]/.test(password)) {
          throw new ConvexError("Use at least 8 characters with a letter and a number.");
        }
      },
    }),
  ],
});
