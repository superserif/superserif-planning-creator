import { createContext, useContext } from "react";

export const SHARE_EMAIL = "partage@superserif.studio";

/** True when the session belongs to the read-only share account. */
export const ReadOnlyContext = createContext(false);

export function useReadOnly(): boolean {
  return useContext(ReadOnlyContext);
}
