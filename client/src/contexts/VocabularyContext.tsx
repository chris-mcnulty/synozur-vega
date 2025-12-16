import { createContext, useContext, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

export type VocabularyTerm = {
  singular: string;
  plural: string;
};

export type VocabularyTerms = {
  goal: VocabularyTerm;
  strategy: VocabularyTerm;
  objective: VocabularyTerm;
  keyResult: VocabularyTerm;
  bigRock: VocabularyTerm;
  meeting: VocabularyTerm;
  focusRhythm: VocabularyTerm;
};

const DEFAULT_VOCABULARY: VocabularyTerms = {
  goal: { singular: "Goal", plural: "Goals" },
  strategy: { singular: "Strategy", plural: "Strategies" },
  objective: { singular: "Objective", plural: "Objectives" },
  keyResult: { singular: "Key Result", plural: "Key Results" },
  bigRock: { singular: "Big Rock", plural: "Big Rocks" },
  meeting: { singular: "Meeting", plural: "Meetings" },
  focusRhythm: { singular: "Focus Rhythm", plural: "Focus Rhythms" },
};

type VocabularyContextType = {
  vocabulary: VocabularyTerms;
  isLoading: boolean;
  t: (key: keyof VocabularyTerms, form?: 'singular' | 'plural') => string;
};

const VocabularyContext = createContext<VocabularyContextType | undefined>(undefined);

export function VocabularyProvider({ children }: { children: ReactNode }) {
  const { data: vocabulary = DEFAULT_VOCABULARY, isLoading } = useQuery<VocabularyTerms>({
    queryKey: ["/api/vocabulary"],
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const t = (key: keyof VocabularyTerms, form: 'singular' | 'plural' = 'singular'): string => {
    const term = vocabulary[key];
    if (!term) {
      return DEFAULT_VOCABULARY[key]?.[form] || key;
    }
    return term[form] || DEFAULT_VOCABULARY[key]?.[form] || key;
  };

  return (
    <VocabularyContext.Provider
      value={{
        vocabulary,
        isLoading,
        t,
      }}
    >
      {children}
    </VocabularyContext.Provider>
  );
}

export function useVocabulary() {
  const context = useContext(VocabularyContext);
  if (!context) {
    return {
      vocabulary: DEFAULT_VOCABULARY,
      isLoading: false,
      t: (key: keyof VocabularyTerms, form: 'singular' | 'plural' = 'singular'): string => {
        return DEFAULT_VOCABULARY[key]?.[form] || key;
      },
    };
  }
  return context;
}
