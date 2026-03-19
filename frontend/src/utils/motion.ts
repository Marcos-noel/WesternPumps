/** Motion variants and animations for consistent Framer Motion usage across the app */
import type { Variants } from "framer-motion";

/** Page transition variants for enter/exit animations */
export const pageVariants: Variants = {
  initial: {
    opacity: 0,
    y: 8,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: "easeOut",
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: {
      duration: 0.2,
      ease: "easeIn",
    },
  },
};

/** Fade in variant for subtle entrances */
export const fadeInVariants: Variants = {
  initial: { opacity: 0 },
  animate: { 
    opacity: 1,
    transition: { duration: 0.3 }
  },
};

/** Slide up variant for cards and list items */
export const slideUpVariants: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" }
  },
};

/** Stagger container for list animations */
export const staggerContainer: Variants = {
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

/** Hover and tap variants for interactive cards */
export const cardHoverVariants: Variants = {
  initial: { y: 0 },
  hover: { y: -2 },
  tap: { scale: 0.995 },
};

/** Scale variant for buttons and interactive elements */
export const scaleTapVariants: Variants = {
  initial: { scale: 1 },
  tap: { scale: 0.95 },
};

/** Animation configuration for loading states */
export const pulseVariants: Variants = {
  animate: {
    opacity: [0.5, 1, 0.5],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

/** Modal/Drawer slide variants */
export const slideInVariants: Variants = {
  initial: { x: "100%" },
  animate: { 
    x: 0,
    transition: { type: "spring", stiffness: 300, damping: 30 }
  },
  exit: { 
    x: "100%",
    transition: { duration: 0.2 }
  },
};

/** List item stagger variant */
export const listItemVariants: Variants = {
  initial: { opacity: 0, x: -8 },
  animate: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.2 }
  },
};

/** Standard duration for quick transitions */
export const motionDuration = {
  fast: 0.15,
  normal: 0.3,
  slow: 0.5,
};

/** Standard easing */
export const motionEasing = {
  easeOut: [0.25, 0.1, 0.25, 1],
  easeIn: [0.25, 0.25, 0.75, 0.75],
  bounce: [0.68, -0.55, 0.265, 1.55],
};
