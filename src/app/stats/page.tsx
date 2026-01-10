import { createClient } from '@/lib/supabaseServer';
import { redirect } from 'next/navigation';
import StatsView from '@/components/StatsView';

export default async function StatsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('group_id, groups(name)')
    .eq('id', user.id)
    .single();

  if (!profile?.group_id || !profile.groups) {
    redirect('/group');
  }

  const groups = profile.groups as any;

  return (
    <StatsView groupName={groups.name} />
  );
}
