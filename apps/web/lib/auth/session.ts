// Server-side session helpers: read the current user from the request cookie.

import { cookies } from "next/headers";
import { getUser, type User } from "../store";
import { SESSION_COOKIE, verifySession } from "./jwt";

export async function currentUser(): Promise<User | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const claims = verifySession(token);
  if (!claims) return null;
  return getUser(claims.sub);
}
