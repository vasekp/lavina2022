import { fees } from './config.js';
import { hash, serverRequest } from './shared.js';

window.addEventListener('DOMContentLoaded', () => {
  {
    const chkbox = document.getElementById('nav-unfold');
    document.querySelector('nav').addEventListener('click', () => {
      chkbox.checked = !chkbox.checked;
    });
  }
  document.addEventListener('submit', ev => submitForm(ev.submitter.form, ev));
  document.addEventListener('input', ev => doAdmin(ev.target));
  document.addEventListener('click', ev => doAdmin(ev.target));
  useCachedLogin();
});

async function submitForm(form, ev) {
  ev.preventDefault();
  switch(form.id) {
    case 'login':
      doLogin(form);
      break;
  }
}

async function doLogin(form) {
  const passwordHash = await hash(form.querySelector('[name="heslo"]').value);
  try {
    const data = await serverRequest('login', {name: 'admin', passwordHash});
    localStorage['adminHash'] = passwordHash;
    document.getElementById('tab-auth').dataset.auth = 1;
    loadTeams();
  } catch(error) {
    console.error(error);
    alert(typeof error === 'string' ? error : 'Neznámá chyba');
  }
}

async function useCachedLogin() {
  const passwordHash = localStorage['adminHash'];
  if(!passwordHash)
    return;
  try {
    await serverRequest('login', {name: 'admin', passwordHash});
    document.getElementById('tab-auth').dataset.auth = 1;
    loadTeams();
  } catch(error) {
    console.error(error);
  }
}

async function loadTeams() {
  const passwordHash = localStorage['adminHash'];
  if(!passwordHash)
    return;
  try {
    const teams = await serverRequest('a:getTeams', {passwordHash});
    const list = document.getElementById('team-list');
    list.replaceChildren();
    const tmp = document.getElementById('tmp-record').content;
    const collator = new Intl.Collator().compare;
    teams.sort((a, b) => collator(a.name, b.name));
    teams.forEach((team, index) => {
      const frag = tmp.cloneNode(true);
      frag.querySelector('.name').htmlFor = frag.querySelector('.expand').id = `radio${index}`;
      frag.querySelector('.name').textContent = team.name;
      frag.querySelector('[data-id="phone"]').textContent = team.phone;
      frag.querySelector('[data-id="email"]').textContent = team.email;
      frag.querySelector('[data-id="size"]').textContent = team.members.length;
      frag.querySelector('[data-id="tshirts"]').textContent = team.members
        .map(member => member.tshirt)
        .filter(type => type && type !== 'nic')
        .join(', ') || 'žádná';
      frag.querySelector('[data-id="date-reg"]').textContent = new Date(team.dateReg).toLocaleString();
      frag.querySelector('[data-id="to-pay"]').textContent = amountDue(team);
      frag.querySelector('[data-id="paid"]').textContent = team.amountPaid ? `${team.amountPaid} (${new Date(team.datePaid).toLocaleString()})` : '—';
      if(team.hidden)
        frag.querySelector('.team-record').dataset.hidden = true;
      frag.querySelector('[data-id="set-hidden"]').checked = team.hidden;
      frag.querySelector('[data-id="set-countin"]').checked = team.countIn;
      frag.querySelector('[data-id="pay-amount"]').value = amountDue(team);
      list.append(frag);
    });
    /* Statistiky */
    const visibleTeams = teams.filter(team => !team.hidden || team.countIn);
    const paidTeams = visibleTeams.filter(team => team.amountPaid || team.countIn);
    document.getElementById('lidi').textContent = `${visibleTeams.length} / ${visibleTeams.reduce((a, t) => a + t.members.length, 0)}`;
    document.getElementById('lidi-paid').textContent = `${paidTeams.length} / ${paidTeams.reduce((a, t) => a + t.members.length, 0)}`;
    const allMembers = paidTeams.flatMap(team => team.members);
    const tally = elm => Object.entries(allMembers.map(member => member[elm]).reduce((a, e) => {
        if(e && e !== 'nic')
          a[e] = (a[e] || 0) + 1;
        return a;
      }, {})).map(e => `${e[1]}× ${e[0]}`).join(', ');
    document.getElementById('tricka').textContent = tally('tshirt');
    document.getElementById('jidla').textContent = `${tally('meal1')}, ${tally('meal2')}`;
    document.getElementById('eml-list').textContent = visibleTeams.map(team => team.email).join(', ');
    document.getElementById('eml-list-paid').textContent = paidTeams.map(team => team.email).join(', ');
    /* Resty */
    const resty = document.getElementById('resty');
    resty.replaceChildren();
    const newLI = text => {
      const li = document.createElement('li');
      li.textContent = text;
      return li;
    };
    for(const team of visibleTeams) {
      if(team.hidden)
        continue;
      const paid = team.amountPaid || 0;
      if(paid !== amountDue(team))
        resty.append(newLI(`Tým ${team.name}: má dáti ${amountDue(team)}, dal ${paid}, rozdíl ${amountDue(team) - paid}`));
      if(team.members.some(member => !member.tshirt))
        resty.append(newLI(`Tým ${team.name}: vybrat trička`));
      if(team.members.some(member => !member.meal1 || !member.meal2))
        resty.append(newLI(`Tým ${team.name}: vybrat jídlo`));
    }

  } catch(error) {
    console.error(error);
    alert(typeof error === 'string' ? error : 'Neznámá chyba');
  }
}

async function doAdmin(tgt) {
  const passwordHash = localStorage['adminHash'];
  if(!passwordHash)
    return;
  if(tgt.dataset.id === 'set-hidden' || tgt.dataset.id === 'set-countin' || tgt.dataset.id === 'update-pay') {
    const record = tgt.closest('.team-record');
    const name = record.querySelector('.name').textContent;
    const [field, value] =
      tgt.dataset.id === 'set-hidden' ? ['hidden', record.querySelector('[data-id="set-hidden"]').checked] :
      tgt.dataset.id === 'set-countin' ? ['countIn', record.querySelector('[data-id="set-countin"]').checked] :
      tgt.dataset.id === 'update-pay' ? ['amountPaid', +record.querySelector('[data-id="pay-amount"]').value] : null;
    try {
      await serverRequest('a:update', {passwordHash, name, field, value});
      loadTeams();
    } catch(error) {
      console.error(error);
      alert(typeof error === 'string' ? error : 'Neznámá chyba');
    }
  } else if(tgt.id === 'reloadFile') {
    try {
      await serverRequest('a:reload', {passwordHash});
      loadTeams();
    } catch(error) {
      console.error(error);
      alert(typeof error === 'string' ? error : 'Neznámá chyba');
    }
  }
}

function amountDue(team) {
  return fees.base + fees.member * team.members.length + fees.tshirt * team.members.map(member => member.tshirt).filter(val => val && val !== 'nic').length;
}
