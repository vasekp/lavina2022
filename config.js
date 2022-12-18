export const teamSize = 5;

export const fees = {
  base: 1500,
  member: 1500,
  tshirt: 250
};

export async function hash(str) {
  const salt = '<"U9>b9B';
  const hex = ta => [...ta].map(b => b.toString(16).padStart(2, '0')).join('');
  const te = new TextEncoder();
  const ta1 = te.encode(salt);
  const ta2 = te.encode(str);
  const ta3 = new Uint8Array(ta1.length + ta2.length);
  ta3.set(ta1, 0);
  ta3.set(ta2, ta1.length);
  const buf = await crypto.subtle.digest("SHA-256", ta3);
  return hex(new Uint8Array(buf));
}
