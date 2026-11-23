import { dataCharts } from '#lib/server/data-charts.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ charts: dataCharts() });
