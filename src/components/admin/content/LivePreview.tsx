import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Monitor, Smartphone, Tablet, ExternalLink, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LivePreviewProps {
  className?: string;
}

const LivePreview: React.FC<LivePreviewProps> = ({ className }) => {
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [key, setKey] = useState(0);

  const deviceWidths = {
    desktop: '100%',
    tablet: '768px',
    mobile: '375px',
  };

  const handleRefresh = () => {
    setKey(prev => prev + 1);
  };

  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <div className="flex items-center gap-1">
          <Button
            variant={device === 'desktop' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setDevice('desktop')}
          >
            <Monitor className="w-4 h-4" />
          </Button>
          <Button
            variant={device === 'tablet' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setDevice('tablet')}
          >
            <Tablet className="w-4 h-4" />
          </Button>
          <Button
            variant={device === 'mobile' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setDevice('mobile')}
          >
            <Smartphone className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <a href="/" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4" />
            </a>
          </Button>
        </div>
      </div>

      {/* Preview Frame */}
      <div className="bg-muted/10 p-4 min-h-[500px] flex items-start justify-center overflow-auto">
        <div
          className="bg-background rounded-lg shadow-lg overflow-hidden transition-all duration-300"
          style={{ 
            width: deviceWidths[device],
            maxWidth: '100%',
          }}
        >
          <iframe
            key={key}
            src="/"
            className="w-full h-[600px] border-0"
            title="Live Preview"
          />
        </div>
      </div>
    </Card>
  );
};

export default LivePreview;
