import React from 'react';

interface AvatarProps {
  src?: string;
  alt?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ src, alt = 'User', size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-xl',
  };

  if (src) {
    return (
      <img 
        src={src} 
        alt={alt} 
        className={`${sizeClasses[size]} rounded-full object-cover border-2 border-[#1E1E1E] ${className}`} 
      />
    );
  }

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-[#333333] flex items-center justify-center text-gray-400 font-bold border-2 border-[#1E1E1E] ${className}`}>
      {alt.charAt(0).toUpperCase()}
    </div>
  );
};