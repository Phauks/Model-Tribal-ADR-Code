/**
 * The icon of each kind of timeline entry, shared by the timeline (src/lib/components/Timeline.svelte)
 * and the Kind filter of the full timeline (src/routes/nations/timeline/+page.svelte), as in the
 * approved mockup (design/shared-timeline).
 */
import FileText from '@lucide/svelte/icons/file-text';
import Gavel from '@lucide/svelte/icons/gavel';
import Landmark from '@lucide/svelte/icons/landmark';
import Scale from '@lucide/svelte/icons/scale';
import ScrollText from '@lucide/svelte/icons/scroll-text';
import type { TimelineKind } from './timeline.ts';

export const kindIcons = { treaty: ScrollText, document: FileText, case: Gavel, opinion: Scale, federal: Landmark } satisfies Record<TimelineKind, unknown>;
