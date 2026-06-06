"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Search, X, Check } from "lucide-react";

interface Item {
  id: string;
  name: string;
  barcode: string;
}

interface SearchableItemSelectProps {
  items: Item[];
  selectedId?: string;
  onSelect: (id: string) => void;
  placeholder?: string;
}

export function SearchableItemSelect({
  items,
  selectedId,
  onSelect,
  placeholder = "Search items...",
}: SearchableItemSelectProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const selectedItem = items.find((item) => item.id === selectedId);
  
  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  // Filter items based on search
  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    item.barcode.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 50); // Limit for performance
  
  const handleSelect = (id: string) => {
    onSelect(id);
    setSearch("");
    setIsOpen(false);
  };
  
  const clearSelection = () => {
    onSelect("");
    setSearch("");
  };
  
  return (
    <div ref={wrapperRef} className="relative">
      {selectedItem && !isOpen ? (
        <div className="flex items-center gap-2 p-2 bg-gray-900 border border-gray-700 rounded-lg">
          <div className="flex-1">
            <p className="text-sm font-medium truncate">{selectedItem.name}</p>
            <p className="text-xs text-gray-500 font-mono">{selectedItem.barcode}</p>
          </div>
          <button
            onClick={() => {
              setIsOpen(true);
              setTimeout(() => inputRef.current?.focus(), 100);
            }}
            className="p-1 hover:bg-gray-800 rounded"
          >
            <Search className="h-4 w-4 text-gray-400" />
          </button>
          <button
            onClick={clearSelection}
            className="p-1 hover:bg-gray-800 rounded"
          >
            <X className="h-4 w-4 text-gray-400" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            ref={inputRef}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            className="pl-9"
          />
        </div>
      )}
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
          {filteredItems.length === 0 ? (
            <p className="p-3 text-sm text-gray-500 text-center">No items found</p>
          ) : (
            filteredItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center gap-3 p-2 text-left hover:bg-gray-800 transition-colors ${
                  selectedId === item.id ? "bg-blue-900/30" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{item.name}</p>
                  <p className="text-xs text-gray-500 font-mono">{item.barcode}</p>
                </div>
                {selectedId === item.id && (
                  <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Multi-select version
interface SearchableItemMultiSelectProps {
  items: Item[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  placeholder?: string;
}

export function SearchableItemMultiSelect({
  items,
  selectedIds,
  onToggle,
  placeholder = "Search items...",
}: SearchableItemMultiSelectProps) {
  const [search, setSearch] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  // Filter items based on search - show all when empty, filter when typing
  const filteredItems = search.length > 0
    ? items.filter((item) =>
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.barcode.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 100)
    : items.slice(0, 100); // Show first 100 when no search
  
  const selectedItems = items.filter((item) => selectedIds.includes(item.id));
  
  return (
    <div ref={wrapperRef}>
      {/* Search input */}
      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={placeholder}
          className="pl-9"
        />
      </div>
      
      {/* Selected items chips */}
      {selectedItems.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {selectedItems.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600/30 text-blue-400 text-xs rounded"
            >
              {item.name}
              <button onClick={() => onToggle(item.id)}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      
      {/* Scrollable item list */}
      <div className="max-h-48 overflow-y-auto border border-gray-700 rounded-lg">
        {filteredItems.length === 0 ? (
          <p className="p-3 text-sm text-gray-500 text-center">No items found</p>
        ) : (
          filteredItems.map((item) => (
            <label
              key={item.id}
              className="flex items-center gap-3 p-2 hover:bg-gray-800 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(item.id)}
                onChange={() => onToggle(item.id)}
                className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-600"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{item.name}</p>
                <p className="text-xs text-gray-500 font-mono">{item.barcode}</p>
              </div>
              {selectedIds.includes(item.id) && (
                <Check className="h-4 w-4 text-green-400" />
              )}
            </label>
          ))
        )}
      </div>
    </div>
  );
}
