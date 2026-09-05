import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ label, className = '', ...props }, ref) => {
  return (
    <div className="w-full">
      {label && <label className="block text-xs text-gray-500 mb-1.5 ml-1">{label}</label>}
      <input
        ref={ref}
        className={`w-full bg-[#1E1E1E] text-white border border-[#333333] rounded-lg px-4 py-2.5 focus:border-[#555555] focus:outline-none transition-colors placeholder-gray-600 ${className}`}
        {...props}
      />
    </div>
  );
});

Input.displayName = 'Input';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ label, className = '', ...props }, ref) => {
  return (
    <div className="w-full">
      {label && <label className="block text-xs text-gray-500 mb-1.5 ml-1">{label}</label>}
      <textarea
        ref={ref}
        className={`w-full bg-[#1E1E1E] text-white border border-[#333333] rounded-lg px-4 py-2.5 focus:border-[#555555] focus:outline-none transition-colors placeholder-gray-600 resize-none ${className}`}
        {...props}
      />
    </div>
  );
});

Textarea.displayName = 'Textarea';