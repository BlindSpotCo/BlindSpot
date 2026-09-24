import { redirect } from 'next/navigation';

// Saved reports now live on the profile page, alongside the rest of the
// account. Kept as a redirect so old links and bookmarks still land.
export default function MyReportsPage() {
  redirect('/profile#saved');
}
