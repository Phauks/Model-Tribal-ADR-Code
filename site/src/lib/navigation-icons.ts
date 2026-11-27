/**
 * The icon beside each link in the section bar's menus (SectionBar.svelte),
 * by the Lucide name site-navigation.ts gives the link (Trevor chose these
 * menus on Nov. 26, 2026: design/section-menus, mockup A).
 */
import Activity from '@lucide/svelte/icons/activity';
import Archive from '@lucide/svelte/icons/archive';
import Bell from '@lucide/svelte/icons/bell';
import BookA from '@lucide/svelte/icons/book-a';
import BookMarked from '@lucide/svelte/icons/book-marked';
import BookOpen from '@lucide/svelte/icons/book-open';
import BookUser from '@lucide/svelte/icons/book-user';
import Briefcase from '@lucide/svelte/icons/briefcase';
import Building from '@lucide/svelte/icons/building';
import Building2 from '@lucide/svelte/icons/building-2';
import Calendar from '@lucide/svelte/icons/calendar';
import CalendarClock from '@lucide/svelte/icons/calendar-clock';
import ChartColumn from '@lucide/svelte/icons/chart-column';
import ChartPie from '@lucide/svelte/icons/chart-pie';
import ClipboardList from '@lucide/svelte/icons/clipboard-list';
import Contact from '@lucide/svelte/icons/contact';
import Copyright from '@lucide/svelte/icons/copyright';
import Database from '@lucide/svelte/icons/database';
import Dices from '@lucide/svelte/icons/dices';
import EyeOff from '@lucide/svelte/icons/eye-off';
import FileCheck from '@lucide/svelte/icons/file-check';
import FileCode from '@lucide/svelte/icons/file-code';
import FileDiff from '@lucide/svelte/icons/file-diff';
import FilePen from '@lucide/svelte/icons/file-pen';
import FileSearch from '@lucide/svelte/icons/file-search';
import FileText from '@lucide/svelte/icons/file-text';
import Flag from '@lucide/svelte/icons/flag';
import Folder from '@lucide/svelte/icons/folder';
import FolderInput from '@lucide/svelte/icons/folder-input';
import Gauge from '@lucide/svelte/icons/gauge';
import Gavel from '@lucide/svelte/icons/gavel';
import HandCoins from '@lucide/svelte/icons/hand-coins';
import HandHeart from '@lucide/svelte/icons/hand-heart';
import Handshake from '@lucide/svelte/icons/handshake';
import Heart from '@lucide/svelte/icons/heart';
import History from '@lucide/svelte/icons/history';
import Inbox from '@lucide/svelte/icons/inbox';
import Info from '@lucide/svelte/icons/info';
import KeyRound from '@lucide/svelte/icons/key-round';
import Landmark from '@lucide/svelte/icons/landmark';
import Languages from '@lucide/svelte/icons/languages';
import Layers from '@lucide/svelte/icons/layers';
import Library from '@lucide/svelte/icons/library';
import LifeBuoy from '@lucide/svelte/icons/life-buoy';
import List from '@lucide/svelte/icons/list';
import ListOrdered from '@lucide/svelte/icons/list-ordered';
import Mail from '@lucide/svelte/icons/mail';
import MapIcon from '@lucide/svelte/icons/map';
import MapPinned from '@lucide/svelte/icons/map-pinned';
import MessageSquare from '@lucide/svelte/icons/message-square';
import Newspaper from '@lucide/svelte/icons/newspaper';
import NotebookPen from '@lucide/svelte/icons/notebook-pen';
import PenLine from '@lucide/svelte/icons/pen-line';
import PenTool from '@lucide/svelte/icons/pen-tool';
import Radar from '@lucide/svelte/icons/radar';
import Receipt from '@lucide/svelte/icons/receipt';
import Scale from '@lucide/svelte/icons/scale';
import Scroll from '@lucide/svelte/icons/scroll';
import ScrollText from '@lucide/svelte/icons/scroll-text';
import Send from '@lucide/svelte/icons/send';
import ShieldCheck from '@lucide/svelte/icons/shield-check';
import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
import Signature from '@lucide/svelte/icons/signature';
import Star from '@lucide/svelte/icons/star';
import TextCursorInput from '@lucide/svelte/icons/text-cursor-input';
import Upload from '@lucide/svelte/icons/upload';
import UserRound from '@lucide/svelte/icons/user-round';
import Users from '@lucide/svelte/icons/users';
import Video from '@lucide/svelte/icons/video';
import type { NavigationIconName } from './site-navigation.ts';

/** Every Lucide icon has the same component type. */
export const navigationIcons: Record<NavigationIconName, typeof BookA> = {
	activity: Activity,
	archive: Archive,
	bell: Bell,
	'book-a': BookA,
	'book-marked': BookMarked,
	'book-open': BookOpen,
	'book-user': BookUser,
	briefcase: Briefcase,
	building: Building,
	'building-2': Building2,
	calendar: Calendar,
	'calendar-clock': CalendarClock,
	'chart-column': ChartColumn,
	'chart-pie': ChartPie,
	'clipboard-list': ClipboardList,
	contact: Contact,
	copyright: Copyright,
	database: Database,
	dices: Dices,
	'eye-off': EyeOff,
	'file-check': FileCheck,
	'file-code': FileCode,
	'file-diff': FileDiff,
	'file-pen': FilePen,
	'file-search': FileSearch,
	'file-text': FileText,
	flag: Flag,
	folder: Folder,
	'folder-input': FolderInput,
	gauge: Gauge,
	gavel: Gavel,
	'hand-coins': HandCoins,
	'hand-heart': HandHeart,
	handshake: Handshake,
	heart: Heart,
	history: History,
	inbox: Inbox,
	info: Info,
	'key-round': KeyRound,
	landmark: Landmark,
	languages: Languages,
	layers: Layers,
	library: Library,
	'life-buoy': LifeBuoy,
	list: List,
	'list-ordered': ListOrdered,
	mail: Mail,
	map: MapIcon,
	'map-pinned': MapPinned,
	'message-square': MessageSquare,
	newspaper: Newspaper,
	'notebook-pen': NotebookPen,
	'pen-line': PenLine,
	'pen-tool': PenTool,
	radar: Radar,
	receipt: Receipt,
	scale: Scale,
	scroll: Scroll,
	'scroll-text': ScrollText,
	send: Send,
	'shield-check': ShieldCheck,
	'shopping-bag': ShoppingBag,
	signature: Signature,
	star: Star,
	'text-cursor-input': TextCursorInput,
	upload: Upload,
	'user-round': UserRound,
	users: Users,
	video: Video
};
