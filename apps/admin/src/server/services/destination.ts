import 'server-only';

import { db } from '@/lib/db';
import { ApiError } from '@/lib/api/handler';

/**
 * Where we go is one level deep: a valley, and the places inside it.
 *
 * The schema would allow a place inside a place; this refuses it. Paro →
 * Taktsang is a hierarchy a traveller uses. Paro → Taktsang → the Butter Lamp
 * Chapel is a breadcrumb nobody reads, a URL nobody types, and a second level
 * of every list in the panel.
 */
export async function checkParent(args: {
  /** The row being saved, or null for a new one. */
  id: string | null;
  parentId: string | null;
  /** Whether the row being saved has places of its own. */
  hasPlaces?: boolean;
}): Promise<void> {
  if (!args.parentId) return;

  if (args.parentId === args.id) {
    throw new ApiError(422, 'INVALID_PARENT', 'A place cannot be inside itself.', {
      parentId: 'A place cannot be inside itself.',
    });
  }

  if (args.hasPlaces) {
    const message = 'This valley has places in it, so it cannot go inside another. Move its places first.';
    throw new ApiError(422, 'INVALID_PARENT', message, { parentId: message });
  }

  const parent = await db.destination.findUnique({
    where: { id: args.parentId },
    select: { parentId: true, deletedAt: true },
  });

  if (!parent || parent.deletedAt) {
    throw new ApiError(422, 'INVALID_PARENT', 'That valley no longer exists.', {
      parentId: 'That valley no longer exists.',
    });
  }

  if (parent.parentId) {
    const message = 'Places go inside a valley, not inside another place.';
    throw new ApiError(422, 'INVALID_PARENT', message, { parentId: message });
  }
}
