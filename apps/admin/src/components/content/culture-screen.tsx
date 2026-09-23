'use client';

import type { ContentStatus } from '@prisma/client';

import { CatalogueList } from './catalogue';
import type { PickedMedia } from '@/components/media/media-picker';

interface Row {
  id: string;
  title: string;
  standfirst: string;
  placeCount: number;
  image: PickedMedia | null;
  status: ContentStatus;
  [key: string]: unknown;
}

/** Culture: what makes Bhutan Bhutan, each piece a page of its own. */
export function CultureList({ canWrite }: { canWrite: boolean }) {
  return (
    <CatalogueList<Row>
      config={{
        endpoint: '/api/culture',
        queryKey: 'culture',
        basePath: '/culture',
        title: 'Culture',
        description:
          'Tshechu, dzongs, textiles, the thirteen arts — what a traveller is about to see, and what it means. Each piece is a page of its own at /culture/…, linked to the places it can be seen. The order here is the order /culture shows them in.',
        primary: (row) => row.title,
        secondary: (row) =>
          [
            row.standfirst,
            row.placeCount ? `seen at ${row.placeCount} place${row.placeCount === 1 ? '' : 's'}` : null,
          ]
            .filter(Boolean)
            .join(' · '),
        thumbnail: (row) => row.image?.url ?? null,
        canAdd: true,
        rowAction: 'Open',
        addLabel: 'Add a piece',
        emptyTitle: 'Nothing on culture yet',
        emptyDescription:
          'Tshechu, dzongs, textiles, the thirteen arts — the pages that explain what a traveller is about to see.',
      }}
      canWrite={canWrite}
    />
  );
}
