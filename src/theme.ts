import {
  Button,
  Combobox,
  ComboboxOption,
  createTheme,
  defaultVariantColorsResolver,
  Input,
  Menu,
  Modal,
  Notification,
  parseThemeColor,
  Popover,
  Table,
  Textarea,
} from '@mantine/core';
import type { VariantColorsResolver } from '@mantine/core';

/**
 * `@prostriveorg/ui/theme`: the ProStrive Mantine theme override, without any application
 * provider, loader, navigation or routing. Applications merge their own additions, e.g.
 * `mergeThemeOverrides(prostriveTheme, createTheme({ components: { Loader: … } }))`.
 */

export const SYSTEM_FONTS =
  '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif';

/** Interface text and tables. Bundled in `@prostriveorg/ui/fonts.css` (optional). */
export const BODY_FONT_FAMILY = `'Inter Variable', ${SYSTEM_FONTS}`;
/** Headings and headline figures. Bundled in `@prostriveorg/ui/fonts.css` (optional). */
export const HEADING_FONT_FAMILY = `'Saira Variable', 'Inter Variable', ${SYSTEM_FONTS}`;

/** Accent #EA871E at shade 5; lighter tints above, darker shades below. */
export const PRIMARY_COLORS = [
  '#fdf5ed',
  '#fcecdb',
  '#f8d6b3',
  '#f4be86',
  '#efa454',
  '#ea871e',
  '#c57119',
  '#9f5b14',
  '#7a450f',
  '#542e0a',
  '#3b2006',
] as const;

/**
 * Light and subtle orange surfaces carry dark orange text: the brand orange
 * itself is too faint to read as text on white or on its own tint. Filled red
 * uses a deeper shade so destructive actions stand out.
 */
export const variantColorResolver: VariantColorsResolver = (input) => {
  const resolved = defaultVariantColorsResolver(input);
  const parsed = parseThemeColor({
    color: input.color ?? input.theme.primaryColor,
    theme: input.theme,
  });
  // Match the sidebar's New scan: orange surface, white label/icons, soft hover.
  if (
    parsed.color === 'primary' &&
    (parsed.shade === undefined || parsed.shade === 5) &&
    input.variant === 'filled'
  ) {
    return {
      ...resolved,
      background: 'var(--mantine-color-primary-5)',
      hover: 'color-mix(in srgb, var(--mantine-color-primary-5) 96%, black)',
      color: 'var(--mantine-color-white)',
      hoverColor: 'var(--mantine-color-white)',
    };
  }
  if (parsed.shade !== undefined) return resolved;

  // Destructive actions read as a firm red, not the pale default shade.
  if (parsed.color === 'red' && input.variant === 'filled') {
    return {
      ...resolved,
      background: 'var(--mantine-color-red-7)',
      hover: 'var(--mantine-color-red-8)',
      color: 'var(--mantine-color-white)',
    };
  }
  if (parsed.color !== 'primary') return resolved;

  if (input.variant === 'light') {
    return {
      ...resolved,
      background: 'var(--mantine-color-primary-0)',
      hover: 'var(--mantine-color-primary-1)',
      color: 'var(--mantine-color-primary-8)',
    };
  }
  if (input.variant === 'subtle') {
    return {
      ...resolved,
      hover: 'var(--mantine-color-primary-0)',
      color: 'var(--mantine-color-primary-8)',
    };
  }
  return resolved;
};

/*
 * Button hierarchy, used the same way on every page:
 *   primary      variant="filled" (default) — the one main action in a view
 *   secondary    variant="default"          — other actions
 *   quiet        variant="subtle" color="gray"
 *   destructive  color="red", subtle in lists and filled in the confirm modal
 */

export const prostriveTheme = createTheme({
  primaryColor: 'primary',
  primaryShade: 5,
  // Brand actions have explicit white labels; other colors use automatic contrast.
  autoContrast: true,
  // Inter for interface text and tables; Saira, squared and technical like the
  // wordmark, for headings and headline figures.
  fontFamily: BODY_FONT_FAMILY,
  defaultRadius: 'xl',
  variantColorResolver,
  headings: {
    fontFamily: HEADING_FONT_FAMILY,
    fontWeight: '700',
    sizes: {
      h1: { fontSize: '28px', lineHeight: '1.2' },
      h2: { fontSize: '20px', lineHeight: '1.3', fontWeight: '650' },
      h3: { fontSize: '16px', lineHeight: '1.4', fontWeight: '650' },
      h4: { fontSize: '14px', lineHeight: '1.4', fontWeight: '650' },
    },
  },
  components: {
    // Run default buttons through the shared resolver instead of CSS fallbacks.
    Button: Button.extend({ defaultProps: { color: 'primary' } }),
    // Forms need gentler corners than pill buttons so text clears the border.
    // Input covers text fields, selects, number fields, and multiline controls.
    Input: Input.extend({ defaultProps: { radius: 'md' } }),
    Textarea: Textarea.extend({
      styles: { input: { '--input-padding-y': 'var(--mantine-spacing-xs)' } },
    }),
    // Floating surfaces and their rows use separate, nested corner sizes.
    Popover: Popover.extend({ defaultProps: { radius: 'md' } }),
    Combobox: Combobox.extend({
      defaultProps: { dropdownPadding: 6 },
    }),
    // Select, MultiSelect, and Autocomplete use their own styles selectors;
    // set the shared option default so each receives the same row corners.
    ComboboxOption: ComboboxOption.extend({
      defaultProps: { style: { borderRadius: 'var(--mantine-radius-sm)' } },
    }),
    Menu: Menu.extend({
      styles: { item: { borderRadius: 'var(--mantine-radius-sm)' } },
    }),
    // Figures in tables line up by digit.
    Table: Table.extend({ styles: { table: { fontVariantNumeric: 'tabular-nums' } } }),
    // Toasts float above cards that share their white surface, so they get a
    // border, a deeper shadow, and corners small enough to keep the accent line.
    Notification: Notification.extend({
      defaultProps: { radius: 'md', withBorder: true },
      styles: {
        root: {
          boxShadow: 'var(--mantine-shadow-xl)',
          paddingBlock: 'var(--mantine-spacing-sm)',
        },
        title: { fontWeight: 650 },
        description: { color: 'var(--mantine-color-text)' },
      },
    }),
    // Every dialog, confirmations included: centred card over a soft, dimmed backdrop.
    Modal: Modal.extend({
      defaultProps: {
        centered: true,
        radius: 'lg',
        padding: 'xl',
        overlayProps: { backgroundOpacity: 0.45, blur: 3 },
        transitionProps: { transition: 'pop', duration: 160 },
      },
      styles: {
        header: { alignItems: 'flex-start', paddingBottom: 'var(--mantine-spacing-xs)' },
        title: {
          fontFamily: 'var(--mantine-font-family-headings)',
          fontSize: '18px',
          fontWeight: 650,
          lineHeight: 1.3,
        },
      },
    }),
  },
  defaultGradient: {
    from: 'primary.4',
    to: 'primary.6',
    deg: 45,
  },
  colors: {
    primary: [...PRIMARY_COLORS],
    // Cool companion to the orange for comparison data and waiting states.
    steel: [
      '#f2f4f6',
      '#e3e7ec',
      '#c4cdd6',
      '#9fadbd',
      '#7489a0',
      '#466280',
      '#3b536d',
      '#30445a',
      '#263547',
      '#1b2634',
      '#141b27',
    ],
    secondary: [
      '#f1f1f3',
      '#e4e4e7',
      '#c9c9cf',
      '#aeaeb7',
      '#93939f',
      '#787887',
      '#60606c',
      '#484851',
      '#303036',
      '#18181b',
      '#111113',
    ],
  },
});
