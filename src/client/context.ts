import { createContext } from "preact";
import type { Api } from "./api";
import type { Store } from "./store";

/** Everything a screen needs, injected once at the top of the tree. */
export interface AppContextValue {
  api: Api;
  store: Store;
}

export const AppContext = createContext<AppContextValue | null>(null);
