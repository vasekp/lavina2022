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
  const tooltips = {
    "": "Nevyřešeno",
    "c1": "Vyřešeno",
    "c2": "Vyřešeno s nápovědou",
    "c3": "Vyřešeno s postupem",
    "skipped": "Přeskočeno",
    "c1 skipped": "Přeskočeno, následně vyřešeno",
    "c2 skipped": "Přeskočeno, následně vyřešeno s nápovědou",
    "c3 skipped": "Přeskočeno, následně vyřešeno s postupem"
  };
  for(const td of document.querySelectorAll('#vysl-table td')) {
    console.log(td.className);
    const tip = tooltips[td.className];
    if(tip)
      td.title = tip;
  }
  document.getElementById('sifry-table').addEventListener('click', ev => {
    const tgt = ev.target;
    if(tgt.classList.contains('spoiler2'))
      alert(tgt.dataset.text);
  });
});
