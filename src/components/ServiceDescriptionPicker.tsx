"use client";

import { useMemo, useState } from "react";

interface ChipDef {
  id: string;
  label: string;
  word: string;
}

const CHIPS: ChipDef[] = [
  { id: "mow", label: "Mow", word: "mow" },
  { id: "edge", label: "Edge", word: "edge" },
  { id: "blow", label: "Blow leaves", word: "blow leaves" },
  { id: "trim", label: "Trim hedges", word: "trim hedges" },
  { id: "weed", label: "Pull weeds", word: "pull weeds" },
  { id: "fertilize", label: "Fertilize", word: "fertilize" },
  { id: "cleanup", label: "Full cleanup", word: "full cleanup" },
  { id: "aerate", label: "Aerate", word: "aerate" },
];

function buildSummary(words: string[], custom: string): string {
  let sentence = "";
  if (words.length === 1) sentence = words[0]!;
  else if (words.length === 2) sentence = `${words[0]} and ${words[1]}`;
  else if (words.length > 2) {
    sentence = `${words.slice(0, -1).join(", ")}, and ${words[words.length - 1]}`;
  }

  if (custom.trim()) {
    sentence = sentence ? `${sentence}; ${custom.trim()}` : custom.trim();
  }
  return sentence ? sentence.charAt(0).toUpperCase() + sentence.slice(1) : "";
}

/**
 * Tap-to-build service description: chips compose the common phrase, an
 * optional detail line covers anything one-off. Emits a hidden
 * `name="description"` field so it drops into any form action unchanged.
 */
export function ServiceDescriptionPicker({ initialDescription = "" }: { initialDescription?: string }) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [custom, setCustom] = useState(initialDescription);

  function toggle(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }

  const summary = useMemo(() => {
    const words = CHIPS.filter((c) => selected[c.id]).map((c) => c.word);
    return buildSummary(words, custom);
  }, [selected, custom]);

  return (
    <div className="space-y-3">
      <div>
        <span className="mb-1 block text-sm font-medium">Service description</span>
        <div className="flex flex-wrap gap-2">
          {CHIPS.map((chip) => {
            const isSelected = !!selected[chip.id];
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => toggle(chip.id)}
                aria-pressed={isSelected}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium ${
                  isSelected
                    ? "bg-(--color-primary) text-white"
                    : "border border-(--color-border) text-gray-700"
                }`}
              >
                {isSelected && (
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path
                      d="M3.5 8.5L6.5 11.5L12.5 4.5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-600">Add detail (optional)</span>
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="e.g. watch for the sprinkler heads"
          className="w-full rounded-lg border border-(--color-border) px-3 py-2 text-base"
        />
      </label>

      <div className="rounded-lg border border-(--color-border) bg-gray-50 px-3 py-2">
        <p className="text-xs font-semibold text-gray-500">Description</p>
        <p className="text-sm text-gray-800">{summary || "Tap a chip above, or add your own detail."}</p>
      </div>

      <input type="hidden" name="description" value={summary} />
    </div>
  );
}
