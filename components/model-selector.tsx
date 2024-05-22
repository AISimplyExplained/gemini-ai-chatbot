// ModelSelector.tsx
'use client';
import React from "react";
import { useModel } from '@/app/context/ModelContext';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export function ModelSelector() {
    const { model, setModel } = useModel(); // Access model state from context

    // Log the current model value from the context
    console.log("Current model from context:", model);

    return (
        <Select defaultValue={model} onValueChange={setModel}>
            <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
                <SelectGroup>
                    <SelectLabel>Model</SelectLabel>
                    <SelectItem value="gpt-3.5-turbo">GPT 3.5</SelectItem>

                    <SelectItem value="gpt-4">GPT-4</SelectItem>
                    <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                    <SelectItem value="gpt-4o-2024-05-13">GPT-4o</SelectItem>
                    <SelectItem value="llama3-70b-8192">Llama 3</SelectItem>
                    <SelectItem value="gemini">Gemini</SelectItem>

                </SelectGroup>
            </SelectContent>
        </Select>
    );
}
