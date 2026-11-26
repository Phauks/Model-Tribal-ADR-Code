/**
 * The Lucide icon for each collection and group on the Statistics page
 * (src/lib/server/collections.ts). A new collection without one gets the
 * plain file icon, so adding a collection never needs a change here.
 */
import type { Component } from 'svelte';
import BookA from '@lucide/svelte/icons/book-a';
import BookOpen from '@lucide/svelte/icons/book-open';
import BookText from '@lucide/svelte/icons/book-text';
import ChartColumn from '@lucide/svelte/icons/chart-column';
import ClipboardList from '@lucide/svelte/icons/clipboard-list';
import FileClock from '@lucide/svelte/icons/file-clock';
import FileText from '@lucide/svelte/icons/file-text';
import Files from '@lucide/svelte/icons/files';
import Gavel from '@lucide/svelte/icons/gavel';
import Handshake from '@lucide/svelte/icons/handshake';
import Landmark from '@lucide/svelte/icons/landmark';
import Library from '@lucide/svelte/icons/library';
import ListChecks from '@lucide/svelte/icons/list-checks';
import MapIcon from '@lucide/svelte/icons/map';
import Newspaper from '@lucide/svelte/icons/newspaper';
import PenLine from '@lucide/svelte/icons/pen-line';
import Scale from '@lucide/svelte/icons/scale';
import Scroll from '@lucide/svelte/icons/scroll';
import ScrollText from '@lucide/svelte/icons/scroll-text';
import User from '@lucide/svelte/icons/user';
import UserRound from '@lucide/svelte/icons/user-round';
import Users from '@lucide/svelte/icons/users';

export const groupIcons: Record<string, Component> = {
	'Native nations': MapIcon,
	'Federal law': Landmark,
	'Courts and cases': Gavel,
	People: Users,
	Reference: Library
};

const collectionIcons: Record<string, Component> = {
	'native-nations': MapIcon,
	'governing-documents': FileClock,
	'tribal-constitutions': ScrollText,
	'tribal-codes': BookText,
	'intergovernmental-agreements': Handshake,
	'oklahoma-state-tribal-agreements': Handshake,
	stories: BookOpen,
	treaties: Scroll,
	'federal-statutes': BookText,
	'federal-regulations': ListChecks,
	'executive-orders': PenLine,
	'federal-register-notices': Newspaper,
	'supreme-court-cases': Gavel,
	'other-court-cases': Scale,
	'tribal-court-opinions': FileText,
	'supreme-courts': Landmark,
	biographies: UserRound,
	justices: Users,
	presidents: User,
	'source-copies': Files,
	charts: ChartColumn,
	'glossary-terms': BookA,
	forms: ClipboardList
};

export const collectionIcon = (identifier: string): Component => collectionIcons[identifier] ?? FileText;
