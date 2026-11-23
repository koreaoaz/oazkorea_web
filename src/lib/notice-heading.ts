/** Keep classification independent of translations and preserve unrelated bracketed titles. */
export function noticeHeading(title: string, isNotice: boolean | undefined, english: boolean) {
  if (!english || isNotice === undefined) return title
  const markers = /^(?:\s*[\[［【(]\s*(?:공지(?:사항)?|홍보|이벤트|notice|announcement|recruitment|event|promotion|publicity|press release|publication|advertisement|PR)\s*[\]］】)]\s*)+/i
  return (isNotice ? '[Notice] ' : '[Recruitment] ') + title.replace(markers, '').trim()
}

