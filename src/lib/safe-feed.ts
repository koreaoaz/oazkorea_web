const FEED_HOST = 'seokx2.tistory.com'
export function approvedFeedURL(value: string): URL | null {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === FEED_HOST && !url.port && !url.username && !url.password ? url : null
  } catch { return null }
}
/** Fixed publisher only; redirects are not followed, including redirects to private addresses. */
export async function readFeedDocument(value: string, fetcher: typeof fetch = fetch): Promise<string> {
  const url = approvedFeedURL(value)
  if (!url) throw new Error('FEED_DESTINATION_DENIED')
  const response = await fetcher(url, {redirect:'error',signal:AbortSignal.timeout(5000),next:{revalidate:300}})
  if (!response.ok || Number(response.headers.get('content-length') ?? 0) > 1048576) throw new Error('FEED_RESPONSE_DENIED')
  const reader = response.body?.getReader()
  if (!reader) return ''
  let size=0, text='';const decoder=new TextDecoder()
  try {
    while(true){const {done,value:chunk}=await reader.read();if(done)break;size+=chunk.length;if(size>1048576)throw new Error('FEED_TOO_LARGE');text+=decoder.decode(chunk,{stream:true})}
    return text+decoder.decode()
  } finally { await reader.cancel().catch(()=>{}) }
}
