import "server-only";
import { userDb } from "./supabase/server";
import { getUser } from "./auth";

export type Badges = {
  messages: number; requests: number; provider_bookings: number; customer_bookings: number;
  listings_to_fix: number; admin_reviews: number; admin_orgs: number;
};
const ZERO: Badges = { messages: 0, requests: 0, provider_bookings: 0, customer_bookings: 0, listings_to_fix: 0, admin_reviews: 0, admin_orgs: 0 };

export async function getBadges(): Promise<Badges> {
  const user = await getUser();
  if (!user) return ZERO;
  const db = await userDb();
  const { data } = await db.rpc("my_badges");
  return { ...ZERO, ...(data ?? {}) };
}

export const providerTotal = (b: Badges) => b.requests + b.provider_bookings + b.listings_to_fix;
export const adminTotal = (b: Badges) => b.admin_reviews + b.admin_orgs;
