import type { StarlightRouteData } from '@astrojs/starlight/route-data';

type SidebarEntry = StarlightRouteData['sidebar'][number];

/** Top-level sidebar groups that are subject domains, in display order. */
const DOMAIN_LABELS = ['Statistics', 'Probability', 'Linear Algebra', 'Machine Learning'] as const;

/** Sentence-case names shown in the domain strip (design system: no title case in UI labels). */
const DISPLAY_NAMES: Record<(typeof DOMAIN_LABELS)[number], string> = {
	Statistics: 'Statistics',
	Probability: 'Probability',
	'Linear Algebra': 'Linear algebra',
	'Machine Learning': 'Machine learning',
};

export interface Domain {
	label: string;
	/** First page of the domain, or null when the domain has no pages yet. */
	href: string | null;
	isActive: boolean;
}

function isDomainLabel(label: string): label is (typeof DOMAIN_LABELS)[number] {
	return (DOMAIN_LABELS as readonly string[]).includes(label);
}

function firstLinkHref(entries: SidebarEntry[]): string | null {
	for (const entry of entries) {
		if (entry.type === 'link') return entry.href;
		const nested = firstLinkHref(entry.entries);
		if (nested) return nested;
	}
	return null;
}

function containsCurrent(entries: SidebarEntry[]): boolean {
	return entries.some((entry) => (entry.type === 'link' ? entry.isCurrent : containsCurrent(entry.entries)));
}

/** Domains for the header strip, with the one holding the current page marked active. */
export function getDomains(sidebar: SidebarEntry[]): Domain[] {
	return sidebar.flatMap((entry) => {
		if (entry.type !== 'group' || !isDomainLabel(entry.label)) return [];
		return [{ label: DISPLAY_NAMES[entry.label], href: firstLinkHref(entry.entries), isActive: containsCurrent(entry.entries) }];
	});
}

/**
 * Sidebar for the current page: only the active domain's group, so the list stays short.
 * Pages outside any domain (the home page, the introduction) keep the full sidebar.
 */
export function filterSidebarToActiveDomain(sidebar: SidebarEntry[]): SidebarEntry[] {
	const activeDomain = sidebar.find(
		(entry) => entry.type === 'group' && isDomainLabel(entry.label) && containsCurrent(entry.entries),
	);
	return activeDomain ? [activeDomain] : sidebar;
}
