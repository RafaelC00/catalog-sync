import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * The app's two personas. Kept as its own context (not folded into
 * `StoreThemeContext`) because it's an orthogonal axis -- either persona
 * can be active for either store, and only `ThemeContext` should own
 * "what does the active store look like".
 */
export type Persona = 'shopper' | 'merchant';

interface PersonaContextValue {
  persona: Persona;
  setPersona: (persona: Persona) => void;
  toggledPersona: Persona;
}

const PersonaContext = createContext<PersonaContextValue | null>(null);

export function PersonaProvider({ children }: { children: React.ReactNode }) {
  const [persona, setPersonaState] = useState<Persona>('shopper');

  const setPersona = useCallback((next: Persona) => {
    setPersonaState(next);
  }, []);

  const value = useMemo<PersonaContextValue>(
    () => ({
      persona,
      setPersona,
      // What tapping the switch would go *to* -- convenience for the
      // switch button so it doesn't have to re-derive this itself.
      toggledPersona: persona === 'shopper' ? 'merchant' : 'shopper',
    }),
    [persona, setPersona]
  );

  return <PersonaContext.Provider value={value}>{children}</PersonaContext.Provider>;
}

export function usePersona(): PersonaContextValue {
  const ctx = useContext(PersonaContext);
  if (!ctx) {
    throw new Error('usePersona must be used within a PersonaProvider');
  }
  return ctx;
}
