'use client';

import * as React from 'react';

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
 */
export function AccountsScreen({
  currentUserId,
  canSeeRoles,
  canManageRoles,
}: {
  currentUserId: string;
  canSeeRoles: boolean;
  canManageRoles: boolean;
}) {
  const [tab, setTab] = React.useState('people');

  if (!canSeeRoles) return <UsersScreen currentUserId={currentUserId} />;

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'people' ? (
        <UsersScreen currentUserId={currentUserId} />
      ) : (
        <RolesScreen canManage={canManageRoles} />
      )}
    </div>
  );
}
