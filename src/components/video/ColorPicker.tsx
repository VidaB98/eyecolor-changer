import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ColorOption {
  name: string;
  value: string;
}

interface ColorPickerProps {
  selectedColor: string;
  predefinedColors: ColorOption[];
  onColorChange: (value: string) => void;
}

export const ColorPicker = ({
  selectedColor,
  predefinedColors,
  onColorChange,
}: ColorPickerProps) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="color-picker">Choose Eye Color</Label>
      <div className="flex gap-4">
        <Select onValueChange={onColorChange} value={selectedColor}>
          <SelectTrigger className="w-[180px]">
            <SelectValue>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: selectedColor }}
                />
                {predefinedColors.find((c) => c.value === selectedColor)?.name ||
                  "Custom"}
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {predefinedColors.map((color) => (
              <SelectItem key={color.value} value={color.value}>
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: color.value }}
                  />
                  {color.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          id="color-picker"
          type="color"
          value={selectedColor}
          onChange={(e) => onColorChange(e.target.value)}
          className="h-10 w-20"
        />
      </div>
    </div>
  );
};