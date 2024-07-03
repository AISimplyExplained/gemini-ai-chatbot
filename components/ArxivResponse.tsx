// @ts-nocheck
"use client"

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useGlobalState } from '@/context/GlobalContext';

export const ArxivResponse = ({ papers }) => {

  const {selectedPdfUrl, setSelectedPdfUrl} = useGlobalState();
  console.log(selectedPdfUrl)
  console.log

  return (
    <div>
      {papers.map((paper, index) => (
        <Card key={index} className="mb-4">
          <CardHeader>
            <CardTitle>{paper.title}</CardTitle>
            <CardDescription>{paper.authors.join(', ')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p><strong>Category:</strong> {paper.category}</p>
            <p>{paper.summary}</p>
          </CardContent>
          <CardFooter className='flex gap-2'>
            <Button><a target='_blank' href={paper.links[0].href}>View on arXiv</a></Button>
            <Button onClick={() => setSelectedPdfUrl(paper.links[1].href)}
            >View pdf</Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
};

export default ArxivResponse;
