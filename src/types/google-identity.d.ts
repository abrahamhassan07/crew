// Minimal ambient types for Google Identity Services (GIS) — the "Sign In
// with Google" button/One Tap library, distinct from the Maps JS API that
// @types/google.maps covers. Only the members this app actually calls.
declare namespace google.accounts.id {
  interface CredentialResponse {
    credential: string;
    select_by?: string;
  }

  interface IdConfiguration {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    nonce?: string;
    use_fedcm_for_prompt?: boolean;
    auto_select?: boolean;
  }

  interface GsiButtonConfiguration {
    type?: "standard" | "icon";
    theme?: "outline" | "filled_blue" | "filled_black";
    size?: "large" | "medium" | "small";
    text?: "signin_with" | "signup_with" | "continue_with" | "signin";
    shape?: "rectangular" | "pill" | "circle" | "square";
    width?: string | number;
    logo_alignment?: "left" | "center";
  }

  function initialize(config: IdConfiguration): void;
  function renderButton(parent: HTMLElement, options: GsiButtonConfiguration): void;
  function prompt(): void;
  function cancel(): void;
}
