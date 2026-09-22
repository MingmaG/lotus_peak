'use client';

import { Loader2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { Breadcrumbs, type Crumb } from '@/components/shared/breadcrumbs';
import { PageHeader } from '@/components/shared/page-header';
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

/**
 * The frame every editor uses.
 *
 * Editing happens on a page of its own rather than in a panel sliding in from
 * the right. The panel was 512 pixels wide and had to hold a rich-text editor
 * with a twenty-button toolbar, a photograph picker, a list of journeys and a
 * table — none of which fit, and all of which the office edits for half an
 * hour at a time.
 *
 * What a page has that a drawer does not: an address somebody can send to a
 * colleague, a back button that means something, browser history, a title in
 * the tab, and room. A drawer is right for a decision that takes ten seconds.
 * None of these take ten seconds.
 *
 * The buttons are repeated at the foot because on a long form the header has
 * scrolled away, and Save being off-screen is how an afternoon's writing gets
 * lost to a closed tab.
 */

export interface EditorPageProps {
  title: string;
  description?: React.ReactNode;
  crumbs: Crumb[];
  /** Where Cancel goes — the list this record came from. */
  backHref: string;
  onSave: () => void;
  isSaving?: boolean;
  saveLabel?: string;
  canSave?: boolean;
  /** Shown as a quiet Remove button; omitted where the record cannot be deleted. */
  onDelete?: () => void;
  deleteLabel?: string;
  deleteDescription?: string;
  /** Anything else that belongs beside Save — a status select, a preview link. */
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function EditorPage({
  title,
  description,
  crumbs,
  backHref,
  onSave,
  isSaving = false,
  saveLabel = 'Save',
  canSave = true,
  onDelete,
  deleteLabel = 'Remove',
  deleteDescription = 'It will come off the website. This cannot be undone.',
  actions,
  children,
}: EditorPageProps) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  /* ⌘S is muscle memory for anybody who has used a CMS before, and the
     browser's own Save-page dialog is never what they meant by it. */
  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 's') {
        event.preventDefault();
        if (canSave && !isSaving) onSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canSave, isSaving, onSave]);

  const buttons = (
    <>
      {actions}
      <Button variant="outline" asChild>
        {/* A router link, not an anchor: a full reload throws away every
            cached query and the unsaved state of every other open form. */}
        <Link href={backHref}>Cancel</Link>
      </Button>
      <Button onClick={onSave} disabled={!canSave || isSaving}>
        {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
        {saveLabel}
      </Button>
    </>
  );

  return (
    <div className="mx-auto max-w-5xl">
      <Breadcrumbs items={crumbs} />

      <PageHeader
        title={title}
        description={description}
        actions={<div className="flex flex-wrap items-center gap-2">{buttons}</div>}
      />

      <div className="space-y-6">{children}</div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        {onDelete ? (
          <Button
            variant="ghost"
            onClick={() => setConfirmOpen(true)}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="mr-1.5 size-4" />
            {deleteLabel}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex flex-wrap items-center gap-2">{buttons}</div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteLabel} “{title}”?</AlertDialogTitle>
            <AlertDialogDescription>{deleteDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
