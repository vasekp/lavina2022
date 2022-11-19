const patt = "áàäâãăčćçďđéěëęíîĺľłňńóöőôồřšśșťúůüűýžź‚‘’ʻ„“”";
const repl = "aaaaaacccddeeeeiilllnnooooorssstuuuuyzz''''\"\"\"";
const map = {};

for(let i = 0; i < patt.length; i++)
  map[patt[i]] = repl[i];

export default function normalize(str) {
  return str
    .trim()
    .toLowerCase()
    .normalize()
    .replace(/[^ -~]/g, c => map[c] || c);
}
