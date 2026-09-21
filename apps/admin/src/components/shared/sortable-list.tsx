'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * A list the office reorders by dragging.
 *
 * The itinerary, the highlights, the inclusions, the FAQ, a page's sections,
 * a journal body. Six screens, one component, because the interaction is the
 * same and the accessibility is the part that gets dropped when it is written
 * six times.
 *
 * ## It is operable from the keyboard
 *
 * `KeyboardSensor` with `sortableKeyboardCoordinates`: tab to a handle, space
 * to lift, arrows to move, space to drop, escape to cancel. dnd-kit announces
 * each step to a screen reader. A drag-only reorder is a list somebody who
 * cannot use a mouse cannot edit, and the itinerary is the single most
 * reordered thing in this panel.
 *
 * ## Order is position, not a stored number
 *
 * `onChange` hands back the whole array in its new order and the caller
 * rewrites `sortOrder` from the index. Adjusting one row's number instead
 * would mean gaps, ties, and a list whose order depends on the tie-break.
 */

export interface SortableListProps<T> {
  items: T[];
  itemKey: (item: T, index: number) => string;
  onChange: (items: T[]) => void;
  renderItem: (item: T, index: number) => React.ReactNode;
  onRemove?: (index: number) => void;
  onAdd?: () => void;
  addLabel?: string;
  /** Shown when the list is empty. */
  empty?: React.ReactNode;
  /** A label per row for the screen-reader announcement. */
  describeItem?: (item: T, index: number) => string;
  disabled?: boolean;
}

export function SortableList<T>({
  items,
  itemKey,
  onChange,
  renderItem,
  onRemove,
  onAdd,
  addLabel = 'Add',
  empty,
  describeItem,
  disabled,
}: SortableListProps<T>) {
  const sensors = useSensors(
    /**
     * Eight pixels before a drag starts.
     *
     * Without it every click on a field inside a row begins a drag, and the
     * row jumps a pixel as somebody puts the cursor in a text box.
     */
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const keys = React.useMemo(
    () => items.map((item, index) => itemKey(item, index)),
    [items, itemKey],
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = keys.indexOf(String(active.id));
    const to = keys.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    onChange(arrayMove(items, from, to));
  }

  return (
    <div className="space-y-3">
      {items.length === 0 && empty && (
        <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          {empty}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        accessibility={{
          announcements: {
            onDragStart: ({ active }) => `Lifted ${label(active.id, keys, items, describeItem)}.`,
            onDragOver: ({ active, over }) =>
              over
                ? `${label(active.id, keys, items, describeItem)} is over position ${keys.indexOf(String(over.id)) + 1}.`
                : undefined,
            onDragEnd: ({ active, over }) =>
              over
                ? `${label(active.id, keys, items, describeItem)} dropped at position ${keys.indexOf(String(over.id)) + 1}.`
                : 'Dropped.',
            onDragCancel: ({ active }) =>
              `Cancelled. ${label(active.id, keys, items, describeItem)} is back where it was.`,
          },
        }}
      >
        <SortableContext items={keys} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {items.map((item, index) => (
              <SortableRow
                key={keys[index]}
                id={keys[index]!}
                disabled={disabled}
                onRemove={onRemove ? () => onRemove(index) : undefined}
                removeLabel={describeItem ? `Remove ${describeItem(item, index)}` : 'Remove'}
              >
                {renderItem(item, index)}
              </SortableRow>
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {onAdd && (
        <Button type="button" variant="outline" size="sm" onClick={onAdd} disabled={disabled}>
          <Plus className="mr-1.5 size-3.5" />
          {addLabel}
        </Button>
      )}
    </div>
  );
}

function label<T>(
  id: string | number,
  keys: string[],
  items: T[],
  describeItem?: (item: T, index: number) => string,
): string {
  const index = keys.indexOf(String(id));
  const item = items[index];
  if (index === -1 || item === undefined) return 'item';
  return describeItem ? describeItem(item, index) : `item ${index + 1}`;
}

function SortableRow({
  id,
  children,
  onRemove,
  removeLabel,
  disabled,
}: {
  id: string;
  children: React.ReactNode;
  onRemove?: () => void;
  removeLabel: string;
  disabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-start gap-2 rounded-lg border bg-card p-3',
        isDragging && 'relative z-10 shadow-lg',
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        disabled={disabled}
        className="mt-1 shrink-0 cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing disabled:cursor-not-allowed"
        aria-label="Reorder. Press space to lift, then the arrow keys."
      >
        <GripVertical className="size-4" />
      </button>

      <div className="min-w-0 flex-1">{children}</div>

      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          disabled={disabled}
          className="shrink-0 text-muted-foreground hover:text-destructive"
          aria-label={removeLabel}
        >
          <Trash2 className="size-4" />
        </Button>
      )}
    </li>
  );
}

/**
 * A list of plain strings — highlights, inclusions, the `points` of a section.
 *
 * Separate from the generic list because the ergonomics matter: pressing Enter
 * in the last field adds another and moves into it, which is the difference
 * between typing eight highlights and clicking Add eight times.
 */
export function StringList({
  items,
  onChange,
  placeholder = 'Write a line…',
  addLabel = 'Add a line',
  empty,
  disabled,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  addLabel?: string;
  empty?: React.ReactNode;
  disabled?: boolean;
}) {
  /**
   * Stable keys for rows whose only content is a string somebody is editing.
   *
   * Keying by index makes dnd-kit lose track of a row mid-drag; keying by the
   * value makes two identical lines collide and React drop one of them as the
   * office types. So each row carries an id that outlives its text.
   */
  const ids = React.useRef<string[]>([]);
  while (ids.current.length < items.length) ids.current.push(crypto.randomUUID());

  return (
    <SortableList
      items={items}
      itemKey={(_, index) => ids.current[index] ?? String(index)}
      onChange={(next) => {
        ids.current = next.map((_, index) => ids.current[index] ?? crypto.randomUUID());
        onChange(next);
      }}
      onRemove={(index) => {
        ids.current.splice(index, 1);
        onChange(items.filter((_, i) => i !== index));
      }}
      onAdd={() => {
        ids.current.push(crypto.randomUUID());
        onChange([...items, '']);
      }}
      addLabel={addLabel}
      empty={empty}
      disabled={disabled}
      describeItem={(item, index) => (item ? `"${item.slice(0, 40)}"` : `line ${index + 1}`)}
      renderItem={(item, index) => (
        <input
          value={item}
          disabled={disabled}
          onChange={(event) => {
            const next = [...items];
            next[index] = event.target.value;
            onChange(next);
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            if (index !== items.length - 1) return;
            ids.current.push(crypto.randomUUID());
            onChange([...items, '']);
            /* Focus the row that is about to exist. A frame is enough for
               React to have rendered it. */
            requestAnimationFrame(() => {
              const list = event.currentTarget.closest('ul');
              const inputs = list?.querySelectorAll('input');
              inputs?.[inputs.length - 1]?.focus();
            });
          }}
          placeholder={placeholder}
          className="w-full border-0 bg-transparent p-0 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-0"
        />
      )}
    />
  );
}
