import { createClient } from '@/lib/supabaseServer';
import { redirect } from 'next/navigation';
import SettingsView from '@/components/SettingsView';

export default async function SettingsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, groups(name, invite_code)')
    .eq('id', user.id)
    .single();

  return (
    <SettingsView 
      user={user} 
      profile={profile} 
    />
  );
}
