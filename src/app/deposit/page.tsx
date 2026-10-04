import { redirect } from 'next/navigation';

export default function DepositRedirectPage() {
  redirect('/?tab=deposit');
}
