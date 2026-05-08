'use server';

import { revalidatePath } from 'next/cache';

/**
 * Invalidate the cached server renders of the player listing pages so a
 * just-saved NTRP/city/photo change shows up immediately on next navigation.
 */
export async function revalidatePlayers(username?: string) {
  revalidatePath('/players');
  if (username) {
    revalidatePath(`/players/${username}`);
  }
}
