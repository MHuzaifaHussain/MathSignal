import type { StarlightRouteData } from '@astrojs/starlight/route-data';
import { DOMAINS } from '../../design/domains.mjs';

type SidebarEntry = StarlightRouteData['sidebar'][number];

export interface Domain {
	label: string;
	/** First page of the domain, or null when the domain has no pages yet. */
	href: string | null;
	isActive: boolean;
}

const DOMAIN_LABELS = new Set(DOMAINS.map((domain) => domain.label));

function isDomainGroup(entry: SidebarEntry): entry is Extract<SidebarEntry, { type: 'group' }> {
	return entry.type === 'group' && DOMAIN_LABELS.has(entry.label);
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

/** Domains for the subject strip, with the one holding the current page marked active. */
export function getDomains(sidebar: SidebarEntry[]): Domain[] {
	const groups = sidebar.filter(isDomainGroup);
	if (groups.length !== DOMAINS.length) {
		const found = groups.map((group) => group.label).join(', ') || 'none';
		throw new Error(
			`Subject strip: expected sidebar groups for ${DOMAINS.map((domain) => domain.label).join(', ')} but found ${found}. ` +
				'Build the sidebar from src/design/domains.mjs.',
		);
	}
	return groups.map((group) => ({ label: group.label, href: firstLinkHref(group.entries), isActive: containsCurrent(group.entries) }));
}

/**
 * Sidebar for the current page: only the active domain's group, so the list stays short.
 * Pages outside any domain (the home page, the introduction) keep the full sidebar.
 */
export function filterSidebarToActiveDomain(sidebar: SidebarEntry[]): SidebarEntry[] {
	const activeDomain = sidebar.find((entry) => isDomainGroup(entry) && containsCurrent(entry.entries));
	return activeDomain ? [activeDomain] : sidebar;
}
