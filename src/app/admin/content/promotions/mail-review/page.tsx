import {redirect} from 'next/navigation'
export const dynamic='force-dynamic'
// Retained for bookmarks; there is one approval list.
export default function Page(){redirect('/admin/content/promotions/approvals')}
