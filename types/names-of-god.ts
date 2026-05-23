export interface NameOfGod {
  id: string;
  nameEn: string;
  nameOriginal: string;
  transliteration: string;
  language: string;
  category: string;
  meaning: string;
  testament: string;
  verseRefs: string[];
}

/** Language filter for the list screen — 'All' returns every entry */
export type LanguageFilter = 'Hebrew' | 'Greek' | 'Aramaic' | 'English' | 'All';
