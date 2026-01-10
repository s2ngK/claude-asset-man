import { createClient } from '@/lib/supabaseServer';
import { redirect } from 'next/navigation';
import MainView from '@/components/MainView';

export default async function Home() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('group_id, groups(name, invite_code)')
    .eq('id', user.id)
    .single();

  if (!profile?.group_id) {
    redirect('/group');
  }

  return (
    <MainView 
      groupName={profile.groups.name} 
      inviteCode={profile.groups.invite_code} 
    />
  );
}
