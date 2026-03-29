import React from 'react';

const SectionDivider: React.FC = () => {
  return (
    <div className="flex items-center justify-center py-1 sm:py-2">
      <div className="flex items-center gap-3 w-full max-w-[200px] sm:max-w-xs">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border/40 to-primary/20" />
        <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
        <div className="flex-1 h-px bg-gradient-to-r from-primary/20 via-border/40 to-transparent" />
      </div>
    </div>
  );
};

export default SectionDivider;
