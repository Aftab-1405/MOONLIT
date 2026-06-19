import { keyframes } from "@mui/material/styles";

/**
 * Shimmer sweep used for "live" / waiting text across chat surfaces.
 * Exported so MessageList and StepsAccordion share exactly the same animation.
 */
export const shimmer = keyframes`
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
`;

/**
 * Entry animation for timeline items and accordion.
 * Pure opacity-fade — no translateY — so items materialise in-place
 * instead of flying up from below, which felt like a loading delay.
 */
export const slideIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

export const TIMELINE_LINE_X = { xs: 10, sm: 11 };
