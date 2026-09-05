import React from 'react';
import { motion } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion'; // FIX: Explicit type-only import

type ButtonVariant = 'primary' | 'ghost' | 'icon' | 'danger';

interface ButtonProps extends HTMLMotionProps<'button'> {
  variant?: ButtonVariant;
}

export const Button: React.FC<ButtonProps> = ({ 
  variant = 'primary', 
  children, 
  className = '', 
  ...props 
}) => {
  const baseStyles = "flex items-center justify-center font-medium transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-[#2A2A2A] hover:bg-[#333333] text-white rounded-lg px-4 py-2.5",
    ghost: "bg-transparent hover:bg-[#1E1E1E] text-gray-400 hover:text-white rounded-lg px-4 py-2",
    icon: "bg-transparent hover:bg-[#1E1E1E] text-gray-400 hover:text-white rounded-full p-2",
    danger: "bg-red-900/20 hover:bg-red-900/40 text-red-500 rounded-lg px-4 py-2.5",
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