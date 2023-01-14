import { fees } from './config.js';
import { hash, serverRequest, adminSalt } from './shared.js';

let teams = [];

window.addEventListener('DOMContentLoaded', () => {
  {
    const chkbox = document.getElementById('nav-unfold');
    document.querySelector('nav').addEventListener('click', () => {
      chkbox.checked = !chkbox.checked;
    });
  }
  document.getElementById('kriteria').addEventListener('input', update);
  document.addEventListener('submit', ev => submitForm(ev.submitter.form, ev));
  {
    const tymy = document.getElementById('tab-tymy');
    tymy.addEventListener('input', ev => doAdmin(ev.target));
    tymy.addEventListener('click', ev => doAdmin(ev.target));
  }
  document.getElementById('refresh').addEventListener('click', loadTeams);
  document.getElementById('reloadFile').addEventListener('click', doReload);
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
  const passwordHash = await hash(form.querySelector('[name="heslo"]').value, adminSalt);
  try {
    const data = await serverRequest('login', {name: 'admin', passwordHash});
    localStorage['adminHash'] = passwordHash;
    document.documentElement.dataset.auth = 1;
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
    document.documentElement.dataset.auth = 1;
    loadTeams();
  } catch(error) {
    console.error(error);
  }
}

async function loadTeams() {
  const passwordHash = localStorage['adminHash'];
  if(!passwordHash)
    return;
  teams = await serverRequest('a:getTeams', {passwordHash});
  update();
}

const timeFormat = new Intl.DateTimeFormat('cs-CZ', { timeStyle: 'short' });
const numberFormat = new Intl.NumberFormat('cs-CZ', { signDisplay: 'always' });
const en2cz = {
  'hint': 'nápověda',
  'wt': 'postup řešení',
  'loc': 'přeskočení',
  'sol': 'řešení',
  'error': 'chybný pokus'
};

function update() {
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
    frag.querySelector('[data-id="sharing"]').textContent = team.sharingPreferences;
    frag.querySelector('[data-id="date-reg"]').textContent = new Date(team.dateRegOrig).toLocaleString();
    frag.querySelector('[data-id="date-due"]').textContent = team.amountPaid ? "zaplaceno" :
      team.dateDue ? new Date(team.dateDue).toLocaleString() : "náhradník";
    frag.querySelector('[data-id="to-pay"]').textContent = amountDue(team);
    frag.querySelector('[data-id="paid"]').textContent = team.amountPaid ? `${team.amountPaid} (${new Date(team.datePaid).toLocaleString()})` : '—';
    if(team.hidden)
      frag.querySelector('.team-record').dataset.hidden = true;
    else if(team.amountPaid)
      frag.querySelector('.team-record').dataset.status = 'paid';
    else if(!team.dateDue)
      frag.querySelector('.team-record').dataset.status = 'backup';
    frag.querySelector('[data-id="set-hidden"]').checked = team.hidden;
    frag.querySelector('[data-id="set-countin"]').checked = team.countIn;
    frag.querySelector('[data-id="pay-amount"]').value = amountDue(team);
    list.append(frag);
  });
  /* Statistiky */
  const krit = {};
  for(const elm of document.getElementById('kriteria').querySelectorAll('input'))
    krit[elm.name] = elm.checked;
  const filtered = teams.filter(team => {
    if(team.hidden)
      return krit.hidden && team.countIn;
    else if(team.amountPaid)
      return krit.paid
    else if(team.dateDue)
      return krit.due
    else
      return krit.backup;
  });
  document.getElementById('lidi').textContent = `${filtered.length} / ${filtered.reduce((a, t) => a + t.members.length, 0)}`;
  const tally = (elm, def = '') => Object.entries(filtered.flatMap(team => team.members).map(member => member[elm]).reduce((a, e) => {
      const val = e || def;
      if(val)
        a[val] = (a[val] || 0) + 1;
      return a;
    }, {})).map(e => `${e[1]}× ${e[0]}`).join(', ');
  document.getElementById('tricka').textContent = tally('tshirt');
  document.getElementById('jidla').textContent = `${tally('meal1', 'pa-maso')}, ${tally('meal2', 'so-maso')}`;
  document.getElementById('eml-list').textContent = filtered.map(team => `${team.name} <${team.email}>`).join(', ');
  /* Resty */
  const resty = document.getElementById('resty');
  resty.replaceChildren();
  const newLI = text => {
    const li = document.createElement('li');
    li.textContent = text;
    return li;
  };
  for(const team of filtered) {
    if(team.hidden)
      continue;
    const status = team.amountPaid ? 'Z' : team.dateDue ? 'P' : 'N';
    const paid = team.amountPaid || 0;
    if(paid !== amountDue(team))
      resty.append(newLI(`Tým ${team.name} (${status}): má dáti ${amountDue(team)}, dal ${paid}, rozdíl ${amountDue(team) - paid}`));
    if(team.members.some(member => !member.tshirt))
      resty.append(newLI(`Tým ${team.name} (${status}): vybrat trička`));
    if(team.members.some(member => !member.meal1 || !member.meal2))
      resty.append(newLI(`Tým ${team.name} (${status}): vybrat jídlo`));
  }
  /* Hra */
  const teams2 = [...teams.filter(team => team.amountPaid || team.countIn)];
  const now = new Date();
  for(const team of teams2) {
    if(team.game) {
      team.pts = team.game.actions.reduce((a, e) => a + e.pts + (e.inval ? -team.game.actions[e.inval - 1].pts : 0), 0);
      if(team.game.actions.length)
        team.last = new Date(team.game.actions[team.game.actions.length - 1].time);
      else
        team.last = now;
    } else {
      team.pts = 0;
      team.last = now;
    }
  }
  teams2.sort((a, b) =>
    a.pts < b.pts ? 1
    : a.pts > b.pts ? -1
    : a.last < b.last ? -1
    : a.last > b.last ? 1
    : collator(a.name, b.name));
  const htmp = document.getElementById('tmp-historie').content;
  const tmp2 = document.getElementById('tmp-hra').content;
  const list2 = document.getElementById('hra-list');
  list2.replaceChildren();
  teams2.forEach((team, index) => {
    const frag = tmp2.cloneNode(true);
    frag.querySelector('.name').htmlFor = frag.querySelector('.expand').id = `radio2-${index}`;
    frag.querySelector('.name').textContent = `${team.name}: ${team.pts} b.`;
    frag.querySelector('.name').dataset.name = team.name;
    const hdiv = frag.querySelector('.historie-div');
    hdiv.replaceChildren();
    if(team.game)
      for(const act of team.game.actions) {
        const clone = htmp.cloneNode(true);
        clone.querySelector('div').dataset.seq = act.seq;
        clone.querySelector('.h-cas').textContent = timeFormat.format(new Date(act.time));
        clone.querySelector('.h-akce').textContent = `${act.stan}: ${en2cz[act.type]}`;
        if(act.type === 'sol' || act.type === 'error')
          clone.querySelector('.h-akce').textContent += ` "${act.text.toUpperCase()}"`;
        clone.querySelector('.h-body').textContent = numberFormat.format(act.pts);
        hdiv.append(clone);
        if(act.inval)
          frag.querySelector(`div[data-seq="${act.inval}"`).classList.add('strike');
      }
    list2.append(frag);
  });
}

async function doAdmin(tgt) {
  const passwordHash = localStorage['adminHash'];
  if(!passwordHash)
    return;
  const record = tgt.closest('.team-record');
  const name = record?.querySelector('.name')?.textContent;
  const setField = (field, value) =>
    serverRequest('a:update', {passwordHash, name, field, value})
      .then(loadTeams)
      .catch(e => {
        console.error(e);
        alert(typeof e === 'string' ? e : 'Neznámá chyba');
      });
  switch(tgt.dataset.id) {
    case 'set-hidden':
      setField('hidden', record.querySelector('[data-id="set-hidden"]').checked);
      break;
    case 'set-countin':
      setField('countIn', record.querySelector('[data-id="set-countin"]').checked);
      break;
    case 'update-pay':
      setField('amountPaid', +record.querySelector('[data-id="pay-amount"]').value);
      break;
    case 'reopen-pay':
      setField('dateReg', new Date());
      break;
  }
}

function doReload() {
  const passwordHash = localStorage['adminHash'];
  if(!passwordHash)
    return;
  serverRequest('a:reload', {passwordHash})
    .then(loadTeams)
    .catch(e => {
      console.error(e);
      alert(typeof e === 'string' ? e : 'Neznámá chyba');
    });
}

function amountDue(team) {
  return fees.base + fees.member * team.members.length + fees.tshirt * team.members.map(member => member.tshirt).filter(val => val && val !== 'nic').length;
}
