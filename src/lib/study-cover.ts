/** Topic-only replacements for absent images; an original image always wins. */
export function studyTopicCover(title:string){
 if(/python|파이썬/i.test(title))return '/study-covers/python-mark.svg'
 if(/VLSI|반도체|회로|집적/i.test(title))return '/study-covers/chip-mark.svg'
 if(/딥러닝|머신러닝|강화학습|자연어|비전|\bai\b|neural|machine learning|deep learning/i.test(title))return '/study-covers/neural-mark.svg'
 if(/웹|web|html|css|javascript|프런트|프론트/i.test(title))return '/study-covers/web-mark.svg'
 if(/C언어|C\s*언어|\bC\b/i.test(title))return '/study-covers/c-mark.svg'
 return '/study-topics/study.svg'
}
