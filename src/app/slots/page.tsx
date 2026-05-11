// /slots was the old "Reservations" list view. It has been folded into
// /courts, which now offers both Map and List views in one place.
import { redirect } from 'next/navigation';

export const metadata = { title: 'Find a Court · Hotties That Hit' };

export default function SlotsPage() {
  redirect('/courts');
}
