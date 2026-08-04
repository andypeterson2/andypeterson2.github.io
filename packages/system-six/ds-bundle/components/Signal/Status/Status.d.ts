// Attribute contract for <s6-status> (a custom element).
export interface StatusAttributes {
  /** state */
  state: "success"|"warning"|"danger"|"idle";
  /** label */
  label: string;
}
