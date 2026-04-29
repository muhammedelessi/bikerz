/**
 * Type declarations for Tap Payments Card SDK v2 (window.CardSDK).
 * Loaded dynamically from https://tap-sdks.b-cdn.net/card/1.0.2/index.js.
 *
 * Reference: https://developers.tap.company/docs/card-sdk-web-v2
 */

export type TapCardLocale = "EN" | "AR";
export type TapCardTheme = "LIGHT" | "DARK";
export type TapCardEdges = "CURVED" | "STRAIGHT";
export type TapCardDirection = "LTR" | "RTL";

export interface TapCardCustomerName {
  lang: TapCardLocale;
  first?: string;
  last?: string;
  middle?: string;
}

export interface TapCardConfig {
  publicKey: string;
  merchant?: { id?: string };
  transaction: {
    amount: number;
    currency: string;
  };
  customer?: {
    id?: string;
    name?: TapCardCustomerName[];
    nameOnCard?: string;
    editable?: boolean;
    contact?: {
      email?: string;
      phone?: { countryCode: string; number: string };
    };
  };
  acceptance?: {
    supportedBrands?: string[];
    supportedCards?: "ALL" | string[];
  };
  fields?: { cardHolder?: boolean };
  addons?: {
    loader?: boolean;
    saveCard?: boolean;
    displayPaymentBrands?: boolean;
  };
  interface?: {
    locale?: TapCardLocale;
    theme?: TapCardTheme;
    edges?: TapCardEdges;
    direction?: TapCardDirection;
    /** Hex color used for the active border, focus rings, and brand accents. */
    colorStyle?: string;
  };
  onReady?: () => void;
  onFocus?: () => void;
  onBinIdentification?: (data: unknown) => void;
  onValidInput?: (data: unknown) => void;
  onInvalidInput?: (data: unknown) => void;
  onError?: (data: unknown) => void;
  onSuccess?: (data: TapTokenizeResult) => void;
  onChangeSaveCardLater?: (isSaveCardSelected: boolean) => void;
}

/** Subset of the token response returned via onSuccess. The `id` (tok_xxx) is what we forward to the backend. */
export interface TapTokenizeResult {
  id: string;
  status?: string;
  type?: string;
  card?: {
    brand?: string;
    last_four?: string;
    first_six?: string;
  };
  [key: string]: unknown;
}

export interface TapCardSdkInstance {
  unmount?: () => void;
}

export interface TapCardSdkGlobal {
  renderTapCard: (containerId: string, config: TapCardConfig) => TapCardSdkInstance;
  tokenize: () => void;
  resetCardInputs?: () => void;
  saveCard?: () => void;
  updateCardConfiguration?: (partial: Partial<TapCardConfig>) => void;
  updateTheme?: (theme: "dark" | "light") => void;
  loadSavedCard?: (cardId: string) => void;
  Theme?: Record<TapCardTheme, TapCardTheme>;
  Locale?: Record<TapCardLocale, TapCardLocale>;
  Edges?: Record<TapCardEdges, TapCardEdges>;
  Direction?: Record<TapCardDirection, TapCardDirection>;
  Currencies?: Record<string, string>;
}

declare global {
  interface Window {
    CardSDK?: TapCardSdkGlobal;
  }
}

export {};
