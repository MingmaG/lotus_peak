'use client';

import { useRouter, useSearchParams } from 'next/navigation';

import { RolesScreen } from '@/components/admin/roles-screen';
import { UsersScreen } from '@/components/admin/users-screen';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * People and roles, on one screen.
 *
 * Two tabs rather than two pages, because they are one job asked from two
 * directions — "what can Pema do" is answered by her role, and "who can do
 * this" is answered by the list of people in it. Splitting them puts a
 * navigation step between the question and the answer.
 *
 * The Roles tab is absent, not disabled, for somebody without `roles.read`:
 * a tab that greets you with a refusal teaches nothing.
 *
 * The tab is in the address (`?tab=roles`) so that saving or cancelling a
 * role's page comes back to the Roles tab, not to People.
 */
export function AccountsScreen({
  currentUserId,
  canWriteUsers,
  canSeeRoles,
  canManageRoles,
}: {
  currentUserId: string;
  canWriteUsers: boolean;
  canSeeRoles: boolean;
  canManageRoles: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get('tab') === 'roles' ? 'roles' : 'people';
  const setTab = (next: string) =>
    router.replace(next === 'roles' ? '/users?tab=roles' : '/users', { scroll: false });

  const people = <UsersScreen currentUserId={currentUserId} canWrite={canWriteUsers} />;
  if (!canSeeRoles) return people;

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'people' ? (
        people
      ) : (
        <RolesScreen canManage={canManageRoles} />
      )}
    </div>
  );
}
