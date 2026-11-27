/**
 * The icon beside each link in the section bar's menus (SectionBar.svelte),
 * by the Lucide name site-navigation.ts gives the link (Trevor chose these
 * menus on Nov. 26, 2026: design/section-menus, mockup A).
 */
import BookA from '@lucide/svelte/icons/book-a';
import BookMarked from '@lucide/svelte/icons/book-marked';
import BookOpen from '@lucide/svelte/icons/book-open';
import Building from '@lucide/svelte/icons/building';
import Building2 from '@lucide/svelte/icons/building-2';
import Calendar from '@lucide/svelte/icons/calendar';
import CalendarClock from '@lucide/svelte/icons/calendar-clock';
import ChartColumn from '@lucide/svelte/icons/chart-column';
import ChartPie from '@lucide/svelte/icons/chart-pie';
import ClipboardList from '@lucide/svelte/icons/clipboard-list';
import Copyright from '@lucide/svelte/icons/copyright';
import Database from '@lucide/svelte/icons/database';
import Dices from '@lucide/svelte/icons/dices';
import FileCheck from '@lucide/svelte/icons/file-check';
import FileCode from '@lucide/svelte/icons/file-code';
import FilePen from '@lucide/svelte/icons/file-pen';
import FileText from '@lucide/svelte/icons/file-text';
import Folder from '@lucide/svelte/icons/folder';
import Gauge from '@lucide/svelte/icons/gauge';
import Gavel from '@lucide/svelte/icons/gavel';
import HandHeart from '@lucide/svelte/icons/hand-heart';
import Handshake from '@lucide/svelte/icons/handshake';
import Heart from '@lucide/svelte/icons/heart';
import History from '@lucide/svelte/icons/history';
import Info from '@lucide/svelte/icons/info';
import Landmark from '@lucide/svelte/icons/landmark';
import Layers from '@lucide/svelte/icons/layers';
import Library from '@lucide/svelte/icons/library';
import LifeBuoy from '@lucide/svelte/icons/life-buoy';
import List from '@lucide/svelte/icons/list';
import ListOrdered from '@lucide/svelte/icons/list-ordered';
import MapIcon from '@lucide/svelte/icons/map';
import MapPinned from '@lucide/svelte/icons/map-pinned';
import Newspaper from '@lucide/svelte/icons/newspaper';
import NotebookPen from '@lucide/svelte/icons/notebook-pen';
import PenLine from '@lucide/svelte/icons/pen-line';
import PenTool from '@lucide/svelte/icons/pen-tool';
import Scale from '@lucide/svelte/icons/scale';
import Scroll from '@lucide/svelte/icons/scroll';
import ScrollText from '@lucide/svelte/icons/scroll-text';
import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
import Signature from '@lucide/svelte/icons/signature';
import UserRound from '@lucide/svelte/icons/user-round';
import Users from '@lucide/svelte/icons/users';
import type { NavigationIconName } from './site-navigation.ts';

/** Every Lucide icon has the same component type. */
export const navigationIcons: Record<NavigationIconName, typeof BookA> = {
	'book-a': BookA,
	'book-marked': BookMarked,
	'book-open': BookOpen,
	building: Building,
	'building-2': Building2,
	calendar: Calendar,
	'calendar-clock': CalendarClock,
	'chart-column': ChartColumn,
	'chart-pie': ChartPie,
	'clipboard-list': ClipboardList,
	copyright: Copyright,
	database: Database,
	dices: Dices,
	'file-check': FileCheck,
	'file-code': FileCode,
	'file-pen': FilePen,
	'file-text': FileText,
	folder: Folder,
	gauge: Gauge,
	gavel: Gavel,
	'hand-heart': HandHeart,
	handshake: Handshake,
	heart: Heart,
	history: History,
	info: Info,
	landmark: Landmark,
	layers: Layers,
	library: Library,
	'life-buoy': LifeBuoy,
	list: List,
	'list-ordered': ListOrdered,
	map: MapIcon,
	'map-pinned': MapPinned,
	newspaper: Newspaper,
	'notebook-pen': NotebookPen,
	'pen-line': PenLine,
	'pen-tool': PenTool,
	scale: Scale,
	scroll: Scroll,
	'scroll-text': ScrollText,
	'shopping-bag': ShoppingBag,
	signature: Signature,
	'user-round': UserRound,
	users: Users
};
