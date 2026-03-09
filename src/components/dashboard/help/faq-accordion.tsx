"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronUp } from "lucide-react";

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqAccordionProps {
  faqs: FaqItem[];
}

export function FaqAccordion({ faqs }: FaqAccordionProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Frequently Asked Questions</CardTitle>
        <CardDescription>
          Click any question to expand the answer
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {faqs.map((faq, faqIndex) => (
          <div
            key={faq.question}
            className="border rounded-lg overflow-hidden"
          >
            <button
              onClick={() => setOpenFaq(openFaq === faqIndex ? null : faqIndex)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
            >
              <span className="font-medium text-sm pr-4">{faq.question}</span>
              {openFaq === faqIndex ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
            </button>
            {openFaq === faqIndex && (
              <div className="px-4 pb-4 text-sm text-muted-foreground border-t bg-muted/30">
                <p className="pt-3">{faq.answer}</p>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
