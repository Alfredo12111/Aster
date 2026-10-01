import { executeQuery } from "../../../../packages/core/query";
import type { Note } from "../../../../packages/core/types";
self.onmessage = (
  event: MessageEvent<{
    requestId: number;
    notes: Note[];
    cards: { id: string; query: string }[];
  }>,
) => {
  const { requestId, notes, cards } = event.data;
  const results: Record<
    string,
    { result?: ReturnType<typeof executeQuery>; error?: string }
  > = {};
  for (const card of cards)
    try {
      results[card.id] = { result: executeQuery(notes, card.query) };
    } catch (e) {
      results[card.id] = { error: e instanceof Error ? e.message : String(e) };
    }
  self.postMessage({ requestId, results });
};
