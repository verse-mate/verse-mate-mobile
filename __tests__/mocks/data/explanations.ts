/**
 * Mock AI Explanation Data Factory
 *
 * Factory functions for creating mock AI-generated explanations for VerseMate tests
 * @version 1.0.0 - Initial version (2025-10-03)
 */

export interface Explanation {
  id: string;
  verseId: string;
  content: string;
  language: string;
  generatedAt: Date;
  translations?: Translation[];
}

export interface Translation {
  language: string;
  content: string;
}

export interface ExplanationRequest {
  verseId: string;
  language?: string;
  includeTranslations?: boolean;
}

/**
 * Create a mock AI explanation
 */
export const createMockExplanation = (overrides?: Partial<Explanation>): Explanation => ({
  id: 'explanation-1',
  verseId: 'verse-1',
  content:
    'This verse is often called the "Gospel in a nutshell" as it summarizes the core message of Christianity: God\'s love for humanity and the gift of salvation through Jesus Christ. The phrase "gave his one and only Son" refers to Jesus Christ, emphasizing the sacrificial nature of God\'s love.',
  language: 'en',
  generatedAt: new Date('2025-10-03T12:00:00Z'),
  ...overrides,
});

/**
 * Create a mock explanation with translations
 */
export const createMockExplanationWithTranslations = (
  overrides?: Partial<Explanation>
): Explanation => ({
  ...createMockExplanation(),
  translations: [
    {
      language: 'es',
      content:
        'Este versículo a menudo se llama el "Evangelio en pocas palabras" ya que resume el mensaje central del cristianismo: el amor de Dios por la humanidad y el regalo de la salvación a través de Jesucristo.',
    },
    {
      language: 'pt',
      content:
        'Este versículo é frequentemente chamado de "Evangelho em poucas palavras", pois resume a mensagem central do cristianismo: o amor de Deus pela humanidade e o dom da salvação através de Jesus Cristo.',
    },
    {
      language: 'fr',
      content:
        "Ce verset est souvent appelé \"l'Évangile en bref\" car il résume le message central du christianisme : l'amour de Dieu pour l'humanité et le don du salut par Jésus-Christ.",
    },
  ],
  ...overrides,
});

// Predefined explanation fixtures
export const mockJohn316Explanation = createMockExplanation({
  id: 'john-3-16-explanation',
  verseId: 'john-3-16',
  content:
    'This verse is often called the "Gospel in a nutshell" as it summarizes the core message of Christianity: God\'s love for humanity and the gift of salvation through Jesus Christ. The phrase "gave his one and only Son" refers to Jesus Christ, emphasizing the sacrificial nature of God\'s love. "Whoever believes" shows that salvation is available to all people, not just a select group. "Eternal life" refers to both the quality and duration of life with God.',
  language: 'en',
  generatedAt: new Date('2025-10-03T12:00:00Z'),
});

export const mockPsalm23Explanation = createMockExplanation({
  id: 'psalm-23-explanation',
  verseId: 'psalm-23-1',
  content:
    'This opening verse of Psalm 23 uses the metaphor of a shepherd to describe God\'s care for his people. In ancient Israel, shepherds were responsible for the complete welfare of their sheep - providing food, water, protection, and guidance. By saying "I lack nothing," David expresses complete trust and contentment in God\'s provision.',
  language: 'en',
  generatedAt: new Date('2025-10-03T12:00:00Z'),
});

export const mockGenesis11Explanation = createMockExplanation({
  id: 'genesis-1-1-explanation',
  verseId: 'genesis-1-1',
  content:
    'This is the opening verse of the entire Bible, establishing God as the eternal Creator who existed before all things. "In the beginning" marks the start of time and creation. The Hebrew word for "created" (bara) is used exclusively for God\'s creative activity, emphasizing that only God can create from nothing. "The heavens and the earth" is a merism (a figure of speech using two contrasting parts to refer to the whole), meaning God created everything.',
  language: 'en',
  generatedAt: new Date('2025-10-03T12:00:00Z'),
});

/**
 * Create a mock explanation request
 */
export const createMockExplanationRequest = (
  overrides?: Partial<ExplanationRequest>
): ExplanationRequest => ({
  verseId: 'verse-1',
  language: 'en',
  includeTranslations: false,
  ...overrides,
});
