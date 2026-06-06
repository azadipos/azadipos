"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Keyboard, X, Delete, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface OnScreenKeyboardProps {
  onInput: (value: string) => void;
  initialValue?: string;
  onClose?: () => void;
  type?: "text" | "number" | "phone";
  className?: string;
}

const KEYBOARD_LAYOUTS = {
  text: [
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["Z", "X", "C", "V", "B", "N", "M", "BACKSPACE"],
    ["SPACE", ".", "-", "@", "CLEAR"],
  ],
  number: [
    ["7", "8", "9"],
    ["4", "5", "6"],
    ["1", "2", "3"],
    [".", "0", "BACKSPACE"],
    ["CLEAR"],
  ],
  phone: [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["-", "0", "BACKSPACE"],
    ["CLEAR"],
  ],
};

export function OnScreenKeyboard({ 
  onInput, 
  initialValue = "", 
  onClose, 
  type = "text",
  className = ""
}: OnScreenKeyboardProps) {
  const [value, setValue] = useState(initialValue);
  const layout = KEYBOARD_LAYOUTS[type];
  
  useEffect(() => {
    onInput(value);
  }, [value, onInput]);
  
  const handleKey = (key: string) => {
    switch (key) {
      case "BACKSPACE":
        setValue(prev => prev.slice(0, -1));
        break;
      case "CLEAR":
        setValue("");
        break;
      case "SPACE":
        setValue(prev => prev + " ");
        break;
      default:
        setValue(prev => prev + key);
    }
  };
  
  const getKeyDisplay = (key: string) => {
    switch (key) {
      case "BACKSPACE":
        return <Delete className="h-5 w-5" />;
      case "CLEAR":
        return "Clear";
      case "SPACE":
        return "Space";
      default:
        return key;
    }
  };
  
  const getKeyWidth = (key: string) => {
    switch (key) {
      case "SPACE":
        return "flex-1";
      case "CLEAR":
        return "flex-1";
      default:
        return "w-12 h-12";
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={`bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl ${className}`}
    >
      {/* Header with close button */}
      {onClose && (
        <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-700">
          <div className="text-sm text-gray-400">On-Screen Keyboard</div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      
      {/* Input display */}
      <div className="mb-3 p-3 bg-gray-800 rounded-lg font-mono text-lg min-h-[48px] flex items-center">
        {value || <span className="text-gray-500">...</span>}
      </div>
      
      {/* Keyboard */}
      <div className="space-y-2">
        {layout.map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-1 justify-center">
            {row.map((key) => (
              <button
                key={key}
                onClick={() => handleKey(key)}
                className={`${getKeyWidth(key)} p-3 bg-gray-800 hover:bg-gray-700 active:bg-gray-600 rounded-lg font-medium text-white transition-colors flex items-center justify-center`}
              >
                {getKeyDisplay(key)}
              </button>
            ))}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// Floating keyboard toggle button for touchscreen
interface KeyboardToggleButtonProps {
  inputRef: React.RefObject<HTMLInputElement>;
  type?: "text" | "number" | "phone";
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
}

export function KeyboardToggleButton({ 
  inputRef, 
  type = "text",
  position = "bottom-right"
}: KeyboardToggleButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  
  useEffect(() => {
    if (inputRef.current) {
      setInputValue(inputRef.current.value);
    }
  }, [inputRef]);
  
  const handleInput = useCallback((value: string) => {
    if (inputRef.current) {
      inputRef.current.value = value;
      // Trigger change event
      const event = new Event('input', { bubbles: true });
      inputRef.current.dispatchEvent(event);
    }
  }, [inputRef]);
  
  const positionClasses = {
    "bottom-right": "bottom-4 right-4",
    "bottom-left": "bottom-4 left-4",
    "top-right": "top-4 right-4",
    "top-left": "top-4 left-4",
  };
  
  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed ${positionClasses[position]} z-50 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-colors`}
        title="Toggle on-screen keyboard"
      >
        <Keyboard className="h-6 w-6" />
      </button>
      
      {/* Keyboard modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-x-0 bottom-0 z-50 p-4">
            <OnScreenKeyboard
              type={type}
              initialValue={inputValue}
              onInput={handleInput}
              onClose={() => setIsOpen(false)}
              className="max-w-lg mx-auto"
            />
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
