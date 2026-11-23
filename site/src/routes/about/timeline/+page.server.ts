import { PageCitations } from '#lib/server/front-matter.ts';
import { comparison, introduction, statusLabels, steps, updated } from '#lib/review-timeline.ts';
import type { PageOutline } from '#lib/site-sections.ts';
import type { PageServerLoad } from './$types';

// The timeline to public review (src/lib/review-timeline.ts), rendered with
// one Sources section for every step.

export const load: PageServerLoad = () => {
	const citations = new PageCitations();
	const introductionHtml = citations.render(introduction);
	const rendered = steps.map((step) => ({
		...step,
		statusLabel: statusLabels[step.status],
		summaryHtml: citations.render(step.summary, step.title),
		detailsHtml: step.details ? citations.render(step.details, step.title) : undefined
	}));
	const comparisonHtml = citations.render(comparison, 'How long this can take');
	const outline: PageOutline = {
		title: 'Timeline to public review',
		items: rendered.map((step, index) => ({
			label: step.title,
			link: `#${step.id}`,
			number: String(index + 1),
			note: step.status === 'now' ? 'now' : undefined
		}))
	};
	return {
		title: 'Timeline to public review',
		updated,
		introductionHtml,
		steps: rendered,
		comparisonHtml,
		sources: citations.uses.list,
		outline
	};
};
