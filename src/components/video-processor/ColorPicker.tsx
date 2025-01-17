import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ColorPickerProps {
  selectedColor: string;
  onColorChange: (color: string) => void;
}

export const ColorPicker = ({ selectedColor, onColorChange }: ColorPickerProps) => {
  return (
    <div>
      <Label htmlFor="color-picker">Choose Eye Color</Label>
      <Input
        id="color-picker"
        type="color"
        value={selectedColor}
        onChange={(e) => onColorChange(e.target.value)}
        className="h-12 w-full"
      />
    </div>
  );
};