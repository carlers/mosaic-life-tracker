import React from 'react';
import { motion } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';

type ButtonVariant = 'primary' | 'ghost' | 'icon' | 'danger';

interface ButtonProps extends HTMLMotionProps<'button'> {
  variant?: ButtonVariant;
}

/**
 * `variant="icon"` renders a button whose only content is an icon and
 * therefore has no accessible name. Every callsite MUST pass
 * `aria-label`. There is no way to synthesize one from an icon child,
 * so this is a per-callsite obligation, audited in batches 1.7.a–c.
 * See docs/PROJECT_REFERENCE.md §14 and the accessibility batch (Item 13).
 *
 * Focus ring: `focus-visible` (keyboard only) rather than `focus`, so
 * pointer users do not see a ring on click. The offset color matches
 * the app's base surface (`#111111`).
 */
export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  children,
  className = '',
  ...props
}) => {
  const baseStyles =
    'flex items-center justify-center font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111] disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-[#2A2A2A] hover:bg-[#333333] text-white rounded-lg px-4 py-2.5',
    ghost:
      'bg-transparent hover:bg-[#1E1E1E] text-gray-400 hover:text-white rounded-lg px-4 py-2',
    icon: 'bg-transparent hover:bg-[#1E1E1E] text-gray-400 hover:text-white rounded-full p-2',
    danger:
      'bg-red-900/20 hover:bg-red-900/40 text-red-500 rounded-lg px-4 py-2.5',
  };

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
};
