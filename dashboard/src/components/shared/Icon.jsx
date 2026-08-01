import React from 'react';
import * as LucideIcons from 'lucide-react';

/**
 * Dynamic Icon Component
 * Renders a Lucide icon by its string name.
 */
const Icon = ({ name, className = '', size = 18, strokeWidth = 2, ...rest }) => {
  const LucideIcon = LucideIcons[name];
  
  if (!LucideIcon) {
    // Fallback to a circle icon if the specified icon doesn't exist
    return <LucideIcons.Circle className={className} size={size} strokeWidth={strokeWidth} {...rest} />;
  }
  
  return <LucideIcon className={className} size={size} strokeWidth={strokeWidth} {...rest} />;
};

export default Icon;
