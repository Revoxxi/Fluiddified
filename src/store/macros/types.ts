export interface MacrosState {
  stored: Macro[];
  categories: MacroCategory[];
  expanded: number[];
}

export interface Macro {
  name: string;
  description?: string;
  alias?: string;
  visible: boolean;
  categoryId?: string;
  category?: MacroCategory;
  /**
   * When true, `categoryId` is controlled only from the UI (not printer.cfg `group`).
   * When false/undefined, a matching `[gcode_macro]` `group` in Klipper can assign the category.
   */
  uiCategorySet?: boolean;
  assignTo?: string;
  disabledWhilePrinting?: boolean;
  color?: string;
  config?: Klipper.GcodeMacroSettings;
  order?: number;
  variables?: Record<string, unknown>
}

export interface MacroCategory {
  id: string;
  name: string;
  count?: number;
  visible?: number;
}
