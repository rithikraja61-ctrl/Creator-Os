import { LemmaClient } from "lemma-sdk";

export const lemmaClient = new LemmaClient({
  podId: import.meta.env.VITE_LEMMA_POD_ID,
});
