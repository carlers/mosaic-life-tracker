import React, { forwardRef, useId } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, className = '', id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs text-gray-400 mb-1.5 ml-1"
          >
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={`w-full bg-[#1E1E1E] text-white border border-[#333333] rounded-lg px-4 py-2.5 focus:border-[#555555] focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus:outline-none transition-colors placeholder-gray-400 ${className}`}
          {...props}
        />
      </div>
    );
  }
);

Input.displayName = 'Input';

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, className = '', id, ...props }, ref) => {
    const generatedId = useId();
    const textareaId = id || generatedId;
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-xs text-gray-400 mb-1.5 ml-1"
          >
            {label}
          </label>
        )}
        <textarea
          id={textareaId}
          ref={ref}
          className={`w-full bg-[#1E1E1E] text-white border border-[#333333] rounded-lg px-4 py-2.5 focus:border-[#555555] focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus:outline-none transition-colors placeholder-gray-400 resize-none ${className}`}
          {...props}
        />
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
