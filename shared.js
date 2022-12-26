export const hex = ta => [...ta].map(b => b.toString(16).padStart(2, '0')).join('');
export const unhex = str => str.match(/../g).map(s => parseInt(s, 16));

export async function hash(str, saltHex) {
  if(saltHex.length != 16)
    throw 'Chyba protokolu.';
  const te = new TextEncoder();
  const ta1 = te.encode(str);
  const ta2 = new Uint8Array(ta1.length + 8);
  ta2.set(unhex(saltHex), 0);
  ta2.set(ta1, 8);
  const buf = await crypto.subtle.digest("SHA-256", ta2);
  return hex(new Uint8Array(buf));
}

export async function serverRequest(type, data) {
  const rqParcel = {type, data};
  const resObj = await fetch('backend.php', { method: 'POST', body: JSON.stringify(rqParcel) });
  switch(resObj.status) {
    case 200:
      return resObj.json().catch(_ => ({}));
    case 400:
      throw await resObj.json().catch(_ => 'Chyba na straně serveru.');
    case 503:
      throw 'Nelze se připojit k databázi.';
  }
}

export const adminSalt = '3c2255393e623942';
