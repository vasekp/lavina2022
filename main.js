import { teamSize, fees, dates, attemptDelay } from './config.js';
import { hash, hex, serverRequest, adminSalt } from './shared.js';

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
  updateTeams();
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

async function updateTeams() {
  try {
    const { capacity, teams } = await serverRequest('getTeams');
    teams.forEach(team => {
      team.dateReg = Date.parse(team.dateReg);
      team.datePaid = Date.parse(team.datePaid);
      team.dateDue = Date.parse(team.dateDue);
    });
    teams.sort((t1, t2) => {
      if(t1.paid && !t2.paid)
        return -1;
      else if(!t1.paid && t2.paid)
        return +1;
      else if(t1.paid && t2.paid)
        return t1.datePaid - t2.datePaid;
      else if(t1.dateDue && !t2.dateDue)
        return -1;
      else if(!t1.dateDue && t2.dateDue)
        return +1;
      else if(t1.dateDue && t2.dateDue)
        return t1.dateDue - t2.dateDue;
      else
        return t1.dateReg - t2.dateReg;
    });
    const table = document.getElementById('tymy-content');
    table.replaceChildren();
    teams.forEach((team, seq) => {
      const fields = [
        seq + 1,
        team.name,
        team.members.join(', '),
        team.paid ? 'ANO' : 'NE'
      ];
      const tr = document.createElement('tr');
      for(const field of fields) {
        const td = document.createElement('td');
        td.textContent = field;
        tr.appendChild(td);
      }
      if(seq + 1 === capacity)
        tr.classList.add('last');
      table.appendChild(tr);
    });
  } catch(error) {
    console.error(error);
    alert(typeof error === 'string' ? error : 'Neznámá chyba');
  }
}
