import { lemmaClient } from '../lemma-client'

/**
 * Upload a file to Lemma Files under /me/ideas/
 */
export async function uploadFile(file: File): Promise<string> {
  const result = await lemmaClient.files.upload(file, {
    directoryPath: `/me/ideas`,
    searchEnabled: true,
  })
  return (result as any).path || `/me/ideas/${file.name}`
}

/**
 * Run auto_tag function on an idea
 */
export async function autoTagIdea(ideaId: string, title: string, content: string, sourceType: string) {
  return lemmaClient.functions.run('auto_tag', {
    input: { idea_id: ideaId, title, content, source_type: sourceType }
  })
}

/**
 * Generate embedding for an idea
 */
export async function generateIdeaEmbedding(ideaId: string, text: string) {
  return lemmaClient.functions.run('generate_embedding', {
    input: { idea_id: ideaId, text }
  })
}

/**
 * Get the pod ID
 */
export function getPodId(): string {
if (!lemmaClient.podId) {
  throw new Error("Pod ID is not configured");
}
return lemmaClient.podId;
}
