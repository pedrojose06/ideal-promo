export interface SerperOrganicResult {
  title: string
  link: string
  snippet: string
  date?: string
}

export interface SerperShoppingResult {
  title: string
  link: string
  price: string
  source: string
  imageUrl?: string
}

export interface SerperResponse {
  organic: SerperOrganicResult[]
  shopping?: SerperShoppingResult[]
}

export async function searchSerper(query: string, type: 'search' | 'shopping' = 'search'): Promise<SerperResponse> {
  const endpoint = type === 'shopping'
    ? 'https://google.serper.dev/shopping'
    : 'https://google.serper.dev/search'

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'X-API-KEY': process.env.SERPER_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: query, gl: 'br', hl: 'pt', num: 10 }),
  })

  if (!res.ok) {
    throw new Error(`Serper API error: ${res.status} ${await res.text()}`)
  }

  const data = await res.json()

  return {
    organic: data.organic ?? [],
    shopping: data.shopping ?? [],
  }
}
