// Context + hook live apart from the provider component so that
// AuthContext.jsx exports only a component (React Fast Refresh requirement).
import { createContext, useContext } from "react";

export const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}
