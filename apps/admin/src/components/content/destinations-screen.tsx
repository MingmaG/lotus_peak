'use client';

import type { ContentStatus } from '@prisma/client';

import { CatalogueList } from './catalogue';
import type { PickedMedia } from '@/components/media/media-picker';

interface Row {
  id: string;
  name: string;
  blurb: string;
  parentId: string | null;
  placeCount: number;
  image: PickedMedia | null;
  status: ContentStatus;
  trips: { id: string; title: string; offered: boolean }[];
  [key: string]: unknown;
}

/**
 * Where we go: the valleys, in the order the site lists them.
 *
 * A row opens the valley's page, which is where its places are listed,
 * ordered and added. The editing itself is one more click, on a page of its
 * own — never a panel over this list.
 */
export function DestinationsList({ canWrite }: { canWrite: boolean }) {
  return (
    <CatalogueList<Row>
      config={{
        endpoint: '/api/destinations',
        queryKey: 'destinations',
        basePath: '/destinations',
        title: 'Where we go',
        description:
          'The valleys the journeys go to, each a page of its own, and the places inside each one — Taktsang in Paro, Punakha Dzong in Punakha. Open a valley to see and order its places. The order here is the order the site shows the valleys in.',
        show: (row) => row.parentId === null,
        primary: (row) => row.name,
        secondary: (row) =>
          [
            row.blurb,
            row.placeCount ? `${row.placeCount} place${row.placeCount === 1 ? '' : 's'}` : null,
            row.trips.some((t) => t.offered)
              ? `${row.trips.filter((t) => t.offered).length} journeys offered`
              : null,
          ]
            .filter(Boolean)
            .join(' · '),
        thumbnail: (row) => row.image?.url ?? null,
        canAdd: true,
        rowAction: 'Open',
        addLabel: 'Add a valley',
        emptyTitle: 'No valleys yet',
        emptyDescription:
          'Paro, Thimphu, Punakha — each valley gets a page of its own, and the places inside it get pages under it.',
      }}
      canWrite={canWrite}
    />
  );
}
