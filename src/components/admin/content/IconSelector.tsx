import React, { useState } from 'react';
import { 
  Shield, Award, Navigation, Users, Bike, Route, Trophy,
  CheckCircle2, Gauge, CornerDownRight, AlertTriangle, CloudRain, Map, Users2,
  Home, Target, BookOpen, Megaphone, Heart, Star, Zap, Crown,
  Flame, Rocket, Globe, Lock, Eye, Clock, Calendar, Bell,
  Gift, Medal, Flag, Compass, Mountain, Sun, Moon, Wind,
  LucideIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const icons: Record<string, LucideIcon> = {
  Shield, Award, Navigation, Users, Bike, Route, Trophy,
  CheckCircle2, Gauge, CornerDownRight, AlertTriangle, CloudRain, Map, Users2,
  Home, Target, BookOpen, Megaphone, Heart, Star, Zap, Crown,
  Flame, Rocket, Globe, Lock, Eye, Clock, Calendar, Bell,
  Gift, Medal, Flag, Compass, Mountain, Sun, Moon, Wind,
};

interface IconSelectorProps {
  value: string;
  onChange: (icon: string) => void;
  label?: string;
  className?: string;
}

const IconSelector: React.FC<IconSelectorProps> = ({ value, onChange, label, className }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const SelectedIcon = icons[value] || Shield;

  const filteredIcons = Object.entries(icons).filter(([name]) =>
    name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-2">
      {label && <label className="text-sm font-medium">{label}</label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn("w-full justify-start gap-2", className)}
          >
            <SelectedIcon className="w-4 h-4" />
            <span className="truncate">{value || 'Select Icon'}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-3" align="start">
          <Input
            placeholder="Search icons..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-3"
          />
          <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto">
            {filteredIcons.map(([name, Icon]) => (
              <Button
                key={name}
                variant={value === name ? "default" : "ghost"}
                size="sm"
                className="h-9 w-9 p-0"
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                }}
                title={name}
              >
                <Icon className="w-4 h-4" />
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default IconSelector;
