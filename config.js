export const teamSize = 5;

export const fees = {
  base: 1500,
  member: 1500,
  tshirt: 250
};

export const dates = {
  regOpen: new Date('2022-12-27T12:00:00.000+01:00'),
  regClose: new Date('2023-01-08T23:59:59.999+01:00'),
  changesClose: new Date('2023-01-20T23:59:59.999+01:00')
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
