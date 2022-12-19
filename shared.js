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
