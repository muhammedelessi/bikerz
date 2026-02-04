import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown, Trash2, Plus, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SortableListProps<T> {
  items: T[];
  onReorder: (items: T[]) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  renderItem: (item: T, index: number) => React.ReactNode;
  addLabel?: string;
  minItems?: number;
  maxItems?: number;
  className?: string;
}

function SortableList<T>({
  items,
  onReorder,
  onAdd,
  onRemove,
  renderItem,
  addLabel = 'Add Item',
  minItems = 1,
  maxItems = 10,
  className,
}: SortableListProps<T>) {
  const moveItem = (fromIndex: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= items.length) return;

    const newItems = [...items];
    const [removed] = newItems.splice(fromIndex, 1);
    newItems.splice(toIndex, 0, removed);
    onReorder(newItems);
  };

  const handleRemove = (index: number) => {
    if (items.length <= minItems) return;
    onRemove(index);
  };

  return (
    <div className={cn("space-y-3", className)}>
      {items.map((item, index) => (
        <div
          key={index}
          className="relative bg-card/50 border border-border rounded-lg p-4"
        >
          {/* Controls */}
          <div className="absolute right-3 top-3 flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => moveItem(index, 'up')}
              disabled={index === 0}
            >
              <ChevronUp className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => moveItem(index, 'down')}
              disabled={index === items.length - 1}
            >
              <ChevronDown className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => handleRemove(index)}
              disabled={items.length <= minItems}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>

          {/* Item Number */}
          <div className="absolute left-3 top-3 flex items-center gap-2 text-muted-foreground">
            <GripVertical className="w-4 h-4" />
            <span className="text-xs font-medium">#{index + 1}</span>
          </div>

          {/* Content */}
          <div className="pt-8">
            {renderItem(item, index)}
          </div>
        </div>
      ))}

      {items.length < maxItems && (
        <Button
          variant="outline"
          className="w-full border-dashed"
          onClick={onAdd}
        >
          <Plus className="w-4 h-4 mr-2" />
          {addLabel}
        </Button>
      )}
    </div>
  );
}

export default SortableList;
