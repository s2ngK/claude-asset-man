'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import { generateInviteCode } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

export default function GroupPage() {
  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // 그룹 생성
  const handleCreateGroup = async () => {
    if (!groupName.trim()) return alert('그룹 이름을 입력해주세요.');
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요합니다.');

      const newCode = generateInviteCode();

      // 1. 그룹 생성
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .insert([{ name: groupName, invite_code: newCode }])
        .select()
        .single();

      if (groupError) throw groupError;

      // 2. 유저의 profile에 group_id 할당
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ group_id: group.id })
        .eq('id', user.id);

      if (profileError) throw profileError;

      alert(`그룹이 생성되었습니다! 초대 코드: ${newCode}`);
      router.push('/');
      router.refresh();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  // 그룹 참여
  const handleJoinGroup = async () => {
    if (!inviteCode.trim()) return alert('초대 코드를 입력해주세요.');
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요합니다.');

      // 1. 초대 코드로 그룹 조회
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('id')
        .eq('invite_code', inviteCode)
        .single();

      if (groupError || !group) throw new Error('유효하지 않은 초대 코드입니다.');

      // 2. 유저의 profile에 group_id 할당
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ group_id: group.id })
        .eq('id', user.id);

      if (profileError) throw profileError;

      alert('그룹에 합류했습니다!');
      router.push('/');
      router.refresh();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 gap-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">반갑습니다!</h1>
        <p className="text-slate-500 dark:text-slate-400">가계부를 함께 쓸 그룹을 만들거나 참여해보세요.</p>
      </div>

      <div className="grid w-full max-w-4xl grid-cols-1 md:grid-cols-2 gap-6">
        {/* 그룹 생성 Card */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>새 그룹 만들기</CardTitle>
            <CardDescription>가족이나 팀을 위한 새로운 그룹을 생성합니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 flex-1">
            <div className="space-y-2">
              <Label htmlFor="group-name">그룹 이름</Label>
              <Input
                id="group-name"
                placeholder="예: 행복한 우리집"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={handleCreateGroup} disabled={loading}>
              그룹 생성하기
            </Button>
          </CardFooter>
        </Card>

        {/* 그룹 참여 Card */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>초대 코드로 참여하기</CardTitle>
            <CardDescription>전달받은 12자리 초대 코드를 입력하세요.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 flex-1">
            <div className="space-y-2">
              <Label htmlFor="invite-code">초대 코드</Label>
              <Input
                id="invite-code"
                placeholder="A1B2C3D4E5F6"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" onClick={handleJoinGroup} disabled={loading}>
              그룹 참여하기
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
