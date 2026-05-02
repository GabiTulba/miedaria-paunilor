export const BREAKPOINTS = {
    sm: 480,
    md: 640,
    lg: 768,
    xl: 1024,
    xxl: 1280,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

export const minWidth = (bp: Breakpoint) => `(min-width: ${BREAKPOINTS[bp]}px)`;
