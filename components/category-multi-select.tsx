// @ts-nocheck

'use client';
import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

import { useActions, useUIState } from 'ai/rsc';

import type { AI } from '../../vercel-ai-rsc/app/action';
interface MultiSelectProps {
  categories: string[];
}

export function CategoryMultiSelect({ categories }: MultiSelectProps) {
  const [, setMessages] = useUIState<typeof AI>();
  const { submitUserMessage } = useActions<typeof AI>();
  const [selected, setSelected] = React.useState<string[]>([]);
  const [inputValue, setInputValue] = React.useState('');

  const filteredCategories = categories.filter(
    category => !selected.includes(category) && category.toLowerCase().includes(inputValue.toLowerCase())
  );


  const query = `the selected category is ${selected.toString()}, now call the show_date_range_selection function to ask for date`
  const handleSubmit = async (event: React.MouseEvent<HTMLButtonElement> | React.FormEvent<HTMLFormElement> ) => {
    event.preventDefault();
    const response = await submitUserMessage(query);
    setMessages(currentMessages => [...currentMessages, response]);
  }

  const handleSelect = (category: string) => {
    setSelected(prev => [...prev, category]);
    setInputValue('');
  };

  const handleRemove = (category: string) => {
    setSelected(prev => prev.filter(item => item !== category));
  };

  return (
    <form>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {selected.map(category => (
            <Badge key={category} variant="secondary">
              {category}
              <button
                type="button"
                className="ml-1 rounded-full outline-none"
                onClick={() => handleRemove(category)}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <Input
          type="text"
          placeholder="Search categories..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
        <div className="mt-2 max-h-60 overflow-auto">
          {filteredCategories.map(category => (
            <div
              key={category}
              className="cursor-pointer p-2 hover:bg-gray-200"
              onClick={() => handleSelect(category)}
            >
              {category}
            </div>
          ))}
        </div>
      </div>
      <input type="hidden" name="selected_categories" value={selected.join(',')} />
      <Button onClick={(event) =>  handleSubmit(event)} className="mt-4">Submit</Button>
    </form>
  );
}