'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiDelete } from '@/lib/api-client';
import { RESOURCES, RESOURCE_META, can } from '@/lib/auth/permissions';

interface Role {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  permissions: string[];
  isSystem: boolean;
  userCount: number;
}

/**
 * What each role may do, as a list. A row opens the role on a page of its own
 * — the permission matrix is thirty rows by four columns and has never fit in
 * anything narrower. See `RoleEditor`.
 */
export function RolesScreen({ canManage }: { canManage: boolean }) {
  const client = useQueryClient();
  const [confirmDelete, setConfirmDelete] = React.useState<Role | null>(null);

  const { data, isLoading } = useQuery<{ roles: Role[] }>({
    queryKey: ['roles'],
    queryFn: () => fetch('/api/roles').then((response) => response.json()),
  });

  const done = (message: string) => {
    void client.invalidateQueries({ queryKey: ['roles'] });
    /* The Accounts tab shows each person's role name beside them. */
    void client.invalidateQueries({ queryKey: ['users'] });
    toast.success(message);
  };

  const remove = useMutation({
    mutationFn: (role: Role) => apiDelete(`/api/roles/${role.id}`),
    onSuccess: () => {
      setConfirmDelete(null);
      done('Removed');
    },
    onError: (error: Error) => toast.error(error.message, { duration: 10_000 }),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const isOwner = (role: Role) => role.slug === 'owner';

  return (
    <div className="space-y-4">
      <ul className="divide-y rounded-lg border">
        {data.roles.map((role) => (
          <li key={role.id} className="flex flex-wrap items-center gap-3 p-4">
            {/* The owner row is not a link: it holds every permission there is
                and the API refuses any change to it, so its page would be a
                form with nothing to do. */}
            <RowLink href={isOwner(role) ? null : `/users/roles/${role.id}`}>
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                {role.name}
                {isOwner(role) && (
                  <span className="flex items-center gap-1 text-[11px] font-normal text-muted-foreground">
                    <Lock className="size-3" />
                    everything, always
                  </span>
                )}
                {role.isSystem && !isOwner(role) && (
                  <span className="text-[11px] font-normal text-muted-foreground">shipped</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {role.description ?? 'No description.'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {role.userCount === 0
                  ? 'Nobody has this role'
                  : `${role.userCount} ${role.userCount === 1 ? 'person' : 'people'}`}
                {' · '}
                {summarise(role)}
              </p>
            </RowLink>

            {canManage && !role.isSystem && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(role)}
                aria-label={`Remove the ${role.name} role`}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </li>
        ))}
      </ul>

      {canManage && (
        <Button variant="outline" size="sm" asChild>
          <Link href="/users/roles/new">
            <Plus className="mr-1.5 size-3.5" />
            Add a role
          </Link>
        </Button>
      )}

      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove the {confirmDelete?.name} role?</AlertDialogTitle>
            <AlertDialogDescription>
              A role can only be removed once nobody has it. This cannot be undone — the
              permissions would have to be ticked again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && remove.mutate(confirmDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RowLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  const className = 'min-w-0 flex-1 text-left';
  return href ? (
    <Link href={href} className={className}>
      {children}
    </Link>
  ) : (
    <div className={className}>{children}</div>
  );
}

/** "Sees 14 areas, changes 6" — the shape of a role, without reading 30 strings. */
function summarise(role: Role): string {
  if (role.permissions.includes('*')) return 'Every permission there is';

  const sees = RESOURCES.filter((resource) => can(role.permissions, `${resource}.read`));
  const changes = RESOURCES.filter(
    (resource) =>
      !RESOURCE_META[resource].readOnly && can(role.permissions, `${resource}.write`),
  );

  if (sees.length === 0) return 'Nothing yet';
  return `sees ${sees.length} of ${RESOURCES.length} areas, changes ${changes.length}`;
}
