'use client';

import * as React from "react"
import { Button } from "@/components/ui/button"
import { useActions, useUIState } from 'ai/rsc';

import type { AI } from '@/lib/chat/actions';

export function DateSelect() {
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);
  const [, setMessages] = useUIState<typeof AI>();
  const { submitUserMessage } = useActions<typeof AI>();
  
  const predefinedRanges = [
    'last 3 months',
    'last 6 months',
    'last 1 year',
    'last 2 years'
  ];

  const calculatePastDate = (range: string): string => {
    const today = new Date();
    switch (range) {
      case 'last 3 months':
        return new Date(today.setMonth(today.getMonth() - 3)).toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit'});
      case 'last 6 months':
        return new Date(today.setMonth(today.getMonth() - 6)).toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit' });
      case 'last 1 year':
        return new Date(today.setFullYear(today.getFullYear() - 1)).toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit' });
      case 'last 2 years':
        return new Date(today.setFullYear(today.getFullYear() - 2)).toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit' });
      default:
        return today.toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });
    }
  };

  const query = `the selected date is ${selectedDate}, now display the researh papers`
  const handleSubmit = async (event: React.MouseEvent<HTMLButtonElement> | React.FormEvent<HTMLFormElement> ) => {
    event.preventDefault();
    const response = await submitUserMessage(query);
    setMessages(currentMessages => [...currentMessages, response]);
  } 

  const handleSelect = (range: string) => {
    setSelectedDate(calculatePastDate(range));
  };

  return (
    <form>
      <div className="space-y-2">
        <div className="mt-2 max-h-60 overflow-auto">
          {predefinedRanges.map(range => (
            <div
              key={range}
              className={`cursor-pointer p-2 hover:bg-gray-900 border rounded-lg ${selectedDate === calculatePastDate(range) ? 'border-gray-300' : ''}`}
              onClick={() => handleSelect(range)}
            >
              {range}
            </div>
          ))}
        </div>
      </div>
      <input type="hidden" name="selected_date" value={selectedDate || ''} />
      <Button disabled={selectedDate ? false:  true} onClick={handleSubmit} className="mt-4">Submit</Button>
    </form>
  );
}
