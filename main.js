import { dates } from './config.js';

window.addEventListener('DOMContentLoaded', () => {
  {
    const chkbox = document.getElementById('nav-unfold');
    document.querySelector('nav').addEventListener('click', () => {
      chkbox.checked = !chkbox.checked;
    });
  }
  document.body.addEventListener('input', ev => {
    if(ev.target.id.substring(0, 4) === 'sel-')
      localStorage['lastTab'] = ev.target.id.substring(4);
  });
  const now = Date.now();
  for(const elm of document.querySelectorAll('date-alt')) {
    const open = dates[elm.dataset.open];
    const close = dates[elm.dataset.close];
    elm.dataset.alt = open && open > now ? 'pre' :
      close && close < now ? 'post' :
        'within';
  }
  for(const elm of document.querySelectorAll('[data-visible-from], [data-visible-until]')) {
    const open = dates[elm.dataset.visibleFrom];
    const close = dates[elm.dataset.visibleUntil];
    elm.hidden = open && open > now ? true :
      close && close < now ? true :
        false;
  }
  showTab(localStorage['lastTab']);
});

function showTab(name) {
  const ckbox = document.getElementById(`sel-${name}`);
  if(!ckbox)
    return;
  ckbox.checked = true;
  document.getElementById('nav-unfold').checked = false;
  localStorage['lastTab'] = name;
}
