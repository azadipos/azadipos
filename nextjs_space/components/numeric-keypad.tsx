"use client";

import { Button } from "@/components/ui/button";
import { Delete, X } from "lucide-react";

interface NumericKeypadProps {
  onKeyPress: (key: string) => void;
  onClear: () => void;
  onBackspace: () => void;
  onSubmit?: () => void;
  submitLabel?: string;
  showDecimal?: boolean;
  size?: "default" | "large";
}

export function NumericKeypad({
  onKeyPress,
  onClear,
  onBackspace,
  onSubmit,
  submitLabel = "Enter",
  showDecimal = false,
  size = "default",
}: NumericKeypadProps) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", showDecimal ? "." : "C", "0", "⌫"];
  
  const buttonSize = size === "large" ? "h-20 w-20 text-2xl" : "h-16 w-16 text-xl";
  
  const handleKeyClick = (key: string) => {
    if (key === "C") {
      onClear();
    } else if (key === "⌫") {
      onBackspace();
    } else if (key === ".") {
      onKeyPress(key);
    } else {
      onKeyPress(key);
    }
  };
  
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        {keys.map((key) => (
          <Button
            key={key}
            variant="pos"
            className={`${buttonSize} font-bold ${key === "⌫" ? "text-red-400" : ""}`}
            onClick={() => handleKeyClick(key)}
          >
            {key === "⌫" ? <Delete className="h-6 w-6" /> : key === "C" ? <X className="h-6 w-6" /> : key}
          </Button>
        ))}
      </div>
      {showDecimal && (
        <Button
          variant="pos"
          className={`${buttonSize} w-full font-bold`}
          onClick={onClear}
        >
          Clear
        </Button>
      )}
      {onSubmit && (
        <Button
          variant="pos-primary"
          className={`${buttonSize} w-full font-bold mt-2`}
          onClick={onSubmit}
        >
          {submitLabel}
        </Button>
      )}
    </div>
  );
}