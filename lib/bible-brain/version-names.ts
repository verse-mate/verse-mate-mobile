/**
 * Corrections to Bible Brain's own version display names.
 *
 * The provider's `name` field is free text maintained by hand upstream, and a
 * few entries are wrong in ways that are visible to users. We show the name
 * verbatim everywhere — the voice picker, the downloads list, the player — so
 * a bad one is bad in four places at once.
 *
 * Keyed on the version abbreviation rather than matched on the string, so an
 * upstream fix silently stops mattering instead of double-correcting, and so
 * the entry is easy to delete once it lands.
 *
 * Deliberately NOT done by transliteration. Mechanically romanising
 * `Корнилеску` gives "Kornilesku"; the man's name is Cornilescu. A
 * three-entry table that is right beats a general rule that is close.
 */

interface VersionNameOverride {
  name: string;
  /** Why we overrode it — kept so the entry can be retired knowingly. */
  reason: string;
}

const OVERRIDES: Readonly<Record<string, VersionNameOverride>> = {
  /**
   * Romanian Cornilescu, catalogued by Bible Brain as
   * `Библия Думитру Корнилеску 1924` — the Romanian title typed in Cyrillic.
   *
   * It is not a Moldovan-Cyrillic edition: the filesets are `RONDCV…`
   * (Dumitru Cornilescu Version), the copyright is the British and Foreign
   * Bible Society's Cornilescu 1924 text, the narrator is Ioan Ciobotă, and
   * the audio is ordinary Romanian. Only the label is in the wrong alphabet,
   * which made it read as a different translation nobody in Romania could
   * place. Checked against the provider on 2026-09-13; reported upstream.
   */
  RONCORN: {
    name: 'Biblia Dumitru Cornilescu 1924',
    reason: 'provider lists the Romanian title in Cyrillic script',
  },
};

/** The name to show for a Bible Brain version. */
export function displayVersionName(abbr: string, providerName: string): string {
  return OVERRIDES[abbr]?.name ?? providerName;
}

/** Test/diagnostic access to the table. */
export function versionNameOverrides(): Readonly<Record<string, VersionNameOverride>> {
  return OVERRIDES;
}
