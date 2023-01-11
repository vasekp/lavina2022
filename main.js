import { teamSize, fees, dates } from './config.js';
import { hash, hex, serverRequest, adminSalt } from './shared.js';

const stanoviste = [
  { name: 'Slunce', defOpen: true },
  { name: 'Merkur', defOpen: true },
  { name: 'Venuše' },
  { name: 'Země' },
  { name: 'Měsíc' },
  { name: 'Mars' },
  { name: 'Jupiter' },
  { name: 'Saturn' },
  { name: 'Uran' },
  { name: 'Neptun' },
  { name: 'Pluto' },
];

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
  if(now > dates.tshirtClose)
    document.getElementById('details-tmpl').content.querySelector('[name="tricko"]').dataset.disabled = '1';
  for(const elm of document.querySelectorAll('form')) {
    elm.addEventListener('input', validateField);
    elm.addEventListener('focusout', validateField);
  }
  document.addEventListener('submit', ev => submitForm(ev.submitter.form, ev));
  for(const button of document.querySelectorAll('button[type="submit"]'))
    button.addEventListener('click', () => validateForm(button.form));
  document.getElementById('logout').addEventListener('click', logout);
  document.getElementById('details').addEventListener('input', updateDetailForm);
  document.getElementById('navrh').addEventListener('click', ev => {
    document.getElementById('navrh-div').hidden = false;
    ev.preventDefault();
  });
  document.getElementById('navrh-div').addEventListener('click', ev => ev.currentTarget.hidden = true);
  for(const tmp of document.querySelectorAll('template[data-per=player]')) {
    for(let i = 1; i <= teamSize.max; i++) {
      const clone = tmp.content.cloneNode(true);
      clone.querySelectorAll('[name]').forEach(elm => elm.name += i);
      tmp.before(clone);
    }
  }
  document.querySelector(`#register input[name="clen1"]`).required = true;
  for(const tmp of document.querySelectorAll('template[data-per=stan]')) {
    for(const stan of stanoviste) {
      const clone = tmp.content.cloneNode(true);
      clone.querySelectorAll('[id]').forEach(elm => elm.id += stan.name);
      clone.querySelectorAll('[for]').forEach(elm => elm.htmlFor += stan.name);
      tmp.before(clone);
    }
  }
  window.addEventListener('beforeunload', ev => {
    if(document.getElementById('saveDetails').dataset.saved === '0')
      ev.preventDefault();
  });
  resetForms();
  updateTeams();
  useCachedLogin();
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

function resetForms() {
  for(const elm of document.querySelectorAll('form input, form select, form textarea')) {
    elm.classList.add('pristine');
    if(!elm.dataset.keep)
      elm.value = '';
  }
}

function validateField(ev) {
  const tgt = ev.target;
  const form = tgt.form;
  tgt.classList.remove('pristine');
  if(tgt.name === 'heslo1' || tgt.name === 'heslo2')
    validatePassword(form);
}

function validatePassword(form) {
  const heslo1 = form.querySelector('[name=heslo1]');
  const heslo2 = form.querySelector('[name=heslo2]');
  if(heslo1 && heslo2) {
    if(heslo1.value !== heslo2.value)
      heslo2.setCustomValidity('Hesla se neshodují.');
    else
      heslo2.setCustomValidity('');
  }
}

function validateForm(form) {
  for(const inp of form.querySelectorAll('input, select'))
    inp.classList.remove('pristine');
  validatePassword(form);
}

async function submitForm(form, ev) {
  ev.preventDefault();
  switch(form.id) {
    case 'register':
      doRegister(form);
      break;
    case 'login':
      doLogin(form);
      break;
    case 'details':
      doDetails(form);
      break;
  }
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

async function doRegister(form) {
  const getField = field => form.querySelector(`[name="${field}"]`).value;
  const members = [];
  for(let i = 1; i <= teamSize.max; i++) {
    const member = getField(`clen${i}`);
    if(member)
      members.push(member);
  }
  try {
    const saltBytes = new Uint8Array(8);
    crypto.getRandomValues(saltBytes);
    const salt = hex(saltBytes);
    const passwordHash = await hash(getField('heslo1'), salt);
    const adminHash = await hash(getField('heslo1'), adminSalt);
    const data = await serverRequest('register',
      {
        name: getField('nazev'),
        email: getField('email'),
        salt,
        passwordHash,
        adminHash,
        phone: getField('telefon'),
        members
      }
    );
    resetForms();
    localStorage['teamName'] = data.name;
    localStorage['passwordHash'] = passwordHash;
    updateTeams();
    loadTeamData(data);
    showTab('auth');
  } catch(error) {
    console.error(error);
    alert(typeof error === 'string' ? error : 'Neznámá chyba');
  }
}

async function doLogin(form) {
  const getField = field => form.querySelector(`[name="${field}"]`).value;
  try {
    const name = getField('nazev');
    const salt = await serverRequest('getSalt', {name});
    const passwordHash = await hash(getField('heslo'), salt);
    const adminHash = await hash(getField('heslo'), adminSalt);
    const data = await serverRequest('login',
      {
        name,
        passwordHash,
        adminHash
      }
    );
    localStorage['teamName'] = data.name;
    localStorage['passwordHash'] = passwordHash;
    if(data.adminLogin)
      localStorage['adminHash'] = adminHash;
    loadTeamData(data);
  } catch(error) {
    console.error(error);
    alert(typeof error === 'string' ? error : 'Neznámá chyba');
  }
  resetForms();
}

async function useCachedLogin() {
  const name = localStorage['teamName'];
  const passwordHash = localStorage['passwordHash'];
  const adminHash = localStorage['adminHash'];
  if(!name || !(passwordHash || adminHash))
    return false;
  try {
    const data = await serverRequest('login', {name, passwordHash, adminHash});
    loadTeamData(data);
    document.getElementById('tab-auth').dataset.auth = 1;
    // TODO game: auth
    return true;
  } catch(error) {
    console.error(error);
    // Fail silently, login will be prompted.
    return false;
  }
}

function loadTeamData(data) {
  const form = document.getElementById('details');
  const getField = field => form.querySelector(`[name="${field}"]`);
  document.getElementById('teamName').innerText = data.name;
  for(const elm of form.querySelectorAll('input, select'))
    elm.value = '';
  getField('telefon').value = data.phone;
  getField('email').value = data.email;
  getField('teamSalt').value = data.salt;
  data.members.forEach((member, index) => {
    getField(`clen${index + 1}`).value = member.name;
    getField(`jidloPa${index + 1}`).value = member.meal1 || 'pa-maso';
    getField(`jidloSo${index + 1}`).value = member.meal2 || 'so-maso';
    getField(`tricko${index + 1}`).value = member.tshirt || '';
  });
  getField('sdileni').value = data.sharingPreferences || '';
  document.getElementById('platba').dataset.paid = data.amountPaid ? 1
    : data.dateDue ? 0 : -1;
  document.getElementById('termin').textContent = new Date(data.dateDue).toLocaleDateString('cs-CZ', { dateStyle: 'medium' });
  document.getElementById('tab-auth').dataset.auth = 1;
  updateDetailForm();
  delete document.getElementById('saveDetails').dataset.saved;
  loadGameData(data.game);
}

function logout(ev) {
  delete localStorage['teamName'];
  delete localStorage['passwordHash'];
  delete document.getElementById('tab-auth').dataset.auth;
  updateTeams();
  ev.preventDefault()
}

function updateDetailForm() {
  let numPlayers = 0;
  let numTShirts = 0;
  for(let i = 1; i <= teamSize.max; i++) {
    const inp = document.querySelector(`#details input[name=clen${i}]`);
    const empty = inp.value === '';
    for(const elm of document.querySelectorAll(`#details select[name*="${i}"]`))
      elm.disabled = empty | elm.dataset.disabled === '1';
    if(!empty) {
      numPlayers++;
      if(document.querySelector(`#details select[name=tricko${i}]`).value)
        numTShirts++;
    }
  }
  // recalculate
  const total = fees.base + fees.member * numPlayers + fees.tshirt * numTShirts;
  let html = `<b>${total} Kč</b> (${fees.base} / tým + ${numPlayers} × ${fees.member} / člen`;
  if(numTShirts > 0)
    html += ` + ${numTShirts} × ${fees.tshirt} / tričko`;
  html += ')';
  document.getElementById('cena').innerHTML = html;
  document.getElementById('saveDetails').dataset.saved = '0';
}

async function doDetails(form) {
  const getField = field => form.querySelector(`[name="${field}"]`).value;
  try {
    const data = {
      name: localStorage['teamName'],
      passwordHash: localStorage['passwordHash'],
      adminHash: localStorage['adminHash'],
      phone: getField('telefon'),
      email: getField('email'),
      sharing: getField('sdileni'),
      members: []
    };
    for(let i = 1; i <= teamSize.max; i++) {
      const name = getField(`clen${i}`);
      if(name)
        data.members.push({
          name,
          meal1: getField(`jidloPa${i}`),
          meal2: getField(`jidloSo${i}`),
          tshirt: getField(`tricko${i}`)
        });
    }
    if(getField('heslo1'))
      data.newPasswordHash = await hash(getField('heslo1'), getField('teamSalt'));
    await serverRequest('update', data);
    if(data.newPasswordHash)
      localStorage['passwordHash'] = data.newPasswordHash;
    resetForms();
    await updateTeams();
    const button = document.getElementById('saveDetails');
    button.dataset.saved = '1';
    button.classList.add('saveFlash');
    button.offsetWidth;
    button.classList.remove('saveFlash');
  } catch(error) {
    console.error(error);
    alert(typeof error === 'string' ? error : 'Neznámá chyba');
  }
}

const timeFormat = new Intl.DateTimeFormat('cs-CZ', { timeStyle: 'short' });
const numberFormat = new Intl.NumberFormat('cs-CZ', { signDisplay: 'always' });
const actionDesc = {
  hint: 'nápověda',
  wt: 'postup řešení',
  loc: 'přeskočení',
  sol: 'řešení'
};

function loadGameData(game) {
  document.getElementById('hra-body').innerText = game.actions.reduce((a, e) => a + e.pts, 0);
  const hdiv = document.getElementById('historie-div');
  const htmp = document.getElementById('historie-tmpl').content;
  hdiv.replaceChildren();
  for(const act of game.actions) {
    const clone = htmp.cloneNode(true);
    clone.querySelector('label').htmlFor = `st-${act.stan}`;
    clone.querySelector('.h-cas').textContent = timeFormat.format(act.time);
    clone.querySelector('.h-akce').textContent = `${act.stan}: ${actionDesc[act.type]}`;
    clone.querySelector('.h-body').textContent = numberFormat(act.pts);
    hdiv.append(clone);
  }
  for(const stan of stanoviste) {
    document.getElementById(`st-${stan.name}`).disabled = !stan.defOpen;
  }
}
