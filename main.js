window.addEventListener('DOMContentLoaded', () => {
  const chkbox = document.getElementById('nav-unfold');
  document.querySelector('nav').addEventListener('click', () => {
    chkbox.checked = !chkbox.checked;
  });
  for(const td of document.querySelectorAll('#sifry-table td:nth-child(3), #sifry-table td:nth-child(5)')) {
    const text = td.textContent;
    if(text === 'není' || text === 'zde')
      continue;
    const inp = document.createElement('input');
    inp.type = 'checkbox';
    inp.hidden = true;
    inp.classList.add('spoiler');
    const span = document.createElement('span');
    span.dataset.text = text;
    const label = document.createElement('label');
    label.append(inp, span);
    td.replaceChildren(label);
  }
  for(const td of document.querySelectorAll('#sifry-table td:nth-child(4)')) {
    const text = td.textContent;
    if(text === 'není')
      continue;
    const span = document.createElement('span');
    span.dataset.text = text;
    span.textContent = 'Ukaž';
    span.tabIndex = 0;
    span.classList.add('spoiler2');
    td.replaceChildren(span);
  }
  document.getElementById('sifry-table').addEventListener('click', ev => {
    const tgt = ev.target;
    if(tgt.classList.contains('spoiler2'))
      alert(tgt.dataset.text);
  });
});
