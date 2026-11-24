/**
 * The inverse of the server's Session-title convention.
 *
 * A member named `Builder` owns a Session titled `Builder - B1 Check`
 * (`sessionTitleFor` in `../session-title.ts`). The add-member dialog prefills
 * the member name from the picked Session's title while the server re-derives
 * the title from that name, so without this strip the two feed each other and
 * every add appends the team name again — the live audit shows exactly that:
 * `Builder - B1 Check` → `Builder-2 - B1 Check` → `Builder-2 - B1 Check - B1 Check`.
 *
 * Repeat stripping is deliberate: it also repairs names that already carry more
 * than one team suffix.
 */
export declare function memberNameFromTitle(title: string | null | undefined, teamName: string | null | undefined): string;
