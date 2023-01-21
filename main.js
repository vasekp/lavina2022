import { teamSize, fees, dates, attemptDelay } from './config.js';
import { hash, hex, serverRequest, adminSalt } from './shared.js';

if(location.protocol !== 'https:' && location.hostname !== 'localhost')
  location.protocol = 'https:';

const stMap = {};
const stPromise = serverRequest('getGameStruct').then(stanList => {
  for(const stan of stanList)
    stMap[stan.name] = stan;
  return stanList;
});

let game; // local copy of server object

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
  stPromise.then(stanoviste => {
    for(const tmp of document.querySelectorAll('template[data-per=stan]')) {
      for(const stan of stanoviste) {
        const clone = tmp.content.cloneNode(true);
        clone.querySelectorAll('[id]').forEach(elm => elm.id += stan.name);
        clone.querySelectorAll('[for]').forEach(elm => elm.htmlFor += stan.name);
        tmp.before(clone);
      }
    }
  });
  document.getElementById('ctverecky').addEventListener('input', ev => updStan(ev.target));
  window.addEventListener('beforeunload', ev => {
    if(document.getElementById('saveDetails').dataset.saved === '0')
      ev.preventDefault();
  });
  document.getElementById('tab-hra').addEventListener('click', ev => doGame(ev.target.id));
  document.getElementById('copy-emoji').addEventListener('click', ev => copyGPS(ev.currentTarget));
  document.getElementById('in-reseni').addEventListener('input', ev => ev.currentTarget.classList.remove('error'));
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
    case 'f-reseni':
      doReseni(form);
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
    document.documentElement.dataset.auth = 1;
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
  document.getElementById('teamName').textContent = data.name;
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
  document.documentElement.dataset.auth = 1;
  updateDetailForm();
  delete document.getElementById('saveDetails').dataset.saved;
  loadGameData(data.game);
}

function logout(ev) {
  delete localStorage['teamName'];
  delete localStorage['passwordHash'];
  delete document.documentElement.dataset.auth;
  game = null;
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
const id2en = {
  'napoveda': 'hint',
  'postup': 'wt',
  'poloha': 'loc',
  'reseni': 'sol'
};
const en2id = {
  'hint': 'napoveda',
  'wt': 'postup',
  'loc': 'poloha',
  'sol': 'reseni',
};
const en2cz = {
  'hint': 'nápověda',
  'wt': 'postup řešení',
  'loc': 'přeskočení',
  'sol': 'řešení',
  'error': 'chybný pokus'
};

async function loadGameData(game_) {
  game = game_;
  const last = await updScore();
  const lastElm = document.getElementById(`st-${last}`);
  if(lastElm)
    lastElm.checked = true;
  updStan(lastElm);
}

async function updScore() { // vrací: stanoviště příslušné poslední akci, či jí otevřené
  document.getElementById('hra-body').textContent = game.actions.reduce((a, e) => a + e.pts + (e.inval ? -game.actions[e.inval - 1].pts : 0), 0);
  const hdiv = document.getElementById('historie-div');
  const htmp = document.getElementById('historie-tmpl').content;
  hdiv.replaceChildren();
  const stanoviste = await stPromise;
  let last = null;
  const now = Date.now();
  for(const stan of stanoviste) {
    if(stan.autoOpen && new Date(stan.autoOpen) < now) {
      document.getElementById(`st-${stan.name}`).disabled = false;
      if(!last)
        last = stan.name;
    } else
      document.getElementById(`st-${stan.name}`).disabled = true;
  }
  for(const ctv of document.querySelectorAll('#ctverecky label'))
    ctv.className = '';
  for(const act of game.actions) {
    const clone = htmp.cloneNode(true);
    clone.querySelector('label').htmlFor = `st-${act.stan}`;
    clone.querySelector('label').dataset.seq = act.seq;
    clone.querySelector('.h-cas').textContent = timeFormat.format(new Date(act.time));
    clone.querySelector('.h-akce').textContent = `${act.stan}: ${en2cz[act.type]}`;
    if(act.type === 'sol' || act.type === 'error')
      clone.querySelector('.h-akce').textContent += ` "${act.text.toUpperCase()}"`;
    clone.querySelector('.h-body').textContent = numberFormat.format(act.pts);
    clone.querySelector('label').htmlFor = `st-${act.stan}`;
    hdiv.prepend(clone);
    if(act.inval)
      document.querySelector(`#historie-div label[data-seq="${act.inval}"`).classList.add('strike');
    last = act.stan;
    if(act.opens) {
      last = act.opens;
      document.getElementById(`st-${last}`).disabled = false;
    }
  }
  for(const stan of stanoviste) {
    if(stan.autoClose && new Date(stan.autoClose) < now)
      document.getElementById(`st-${stan.name}`).disabled = true;
  }
  for(const stan in game.summary) {
    const ctv = document.querySelector(`#ctverecky label[for="st-${stan}"]`);
    const rec = game.summary[stan];
    if(rec.hint || rec.wt || rec.loc)
      ctv.classList.add('penalty');
    if(rec.sol)
      ctv.classList.add('solved');
  }
  return last;
}

function updStan(which) {
  if(!which) {
    document.getElementById('st-section').hidden = true;
    return;
  } else
    document.getElementById('st-section').hidden = false;
  const stan = typeof which === 'string' ? which : which.id.substring(3);
  for(const elm of document.querySelectorAll('.stanName'))
    elm.textContent = stan;
  const state = game.summary[stan] || { };
  document.getElementById('sad-menu').checked = true;
  const enable = (what, enable) => {
    document.getElementById(`sad-${what}`).disabled = !enable;
    document.querySelector(`label[for="sad-${what}"]`).hidden = !enable;
  }
  for(const act of ['reseni', 'napoveda', 'poloha', 'postup'])
    enable(act, true);
  if(state.opened) {
    const row = game.actions[state.opened - 1];
    const {text, gps} = row.loc;
    const gpsText = `${gps[0]}N, ${gps[1]}E`;
    document.getElementById('st-poloha').hidden = false;
    document.getElementById('st-pol-text').textContent = text;
    document.getElementById('st-pol-link').textContent = gpsText;
    document.getElementById('st-pol-link').href = `https://mapy.cz/zimni?q=${gpsText}`;
    document.getElementById('copy-emoji').dataset.text = gpsText;
  } else
    document.getElementById('st-poloha').hidden = true;
  if(state.hint) {
    const row = game.actions[state.hint - 1];
    document.getElementById('st-napoveda').hidden = false;
    document.getElementById('st-napoveda-text').textContent = row.text;
    enable('napoveda', false);
  } else {
    enable('napoveda', stMap[stan].hintAvailable);
    document.getElementById('st-napoveda').hidden = true;
  }
  if(state.wt) {
    const row = game.actions[state.wt - 1];
    document.getElementById('st-postup').hidden = false;
    document.getElementById('st-postup-text').textContent = row.text;
    enable('napoveda', false);
    enable('postup', false);
  } else {
    enable('postup', stMap[stan].wtAvailable);
    document.getElementById('st-postup').hidden = true;
  }
  if(state.sol) {
    const row = game.actions[state.sol - 1];
    document.getElementById('st-reseni').hidden = false;
    document.getElementById('st-reseni-text').textContent = row.text;
    for(const act of ['reseni', 'napoveda', 'poloha', 'postup'])
      enable(act, false);
  } else
    document.getElementById('st-reseni').hidden = true;
  {
    const elm = document.getElementById('b-reseni');
    if(elm.dataset.timer) {
      clearTimeout(+elm.dataset.timer);
      delete elm.dataset.timer;
    }
    elm.disabled = false;
    if(state.error) {
      const errRow = game.actions[state.error - 1];
      const errTime = new Date(errRow.time);
      let diff = attemptDelay - Math.floor((new Date() - errTime) / 1000);
      const minsec = x => `${Math.floor(x / 60)}:${(x % 60).toString().padStart(2, '0')}`;
      const timer = setInterval(_ => {
        diff -= 1;
        if(diff <= 0 && timer === +elm.dataset.timer) {
          clearTimeout(timer);
          delete elm.dataset.timer;
          elm.disabled = false;
        } else
          elm.dataset.delay = minsec(diff);
      }, 1000);
      elm.disabled = true;
      elm.dataset.delay = minsec(diff);
      elm.dataset.timer = timer;
    }
  }
  if(state.loc || stMap[stan].final)
    enable('poloha', false);
  for(const elm of document.querySelectorAll('.new'))
    elm.classList.remove('new');
  const inp = document.getElementById('in-reseni');
  inp.value = '';
  inp.classList.remove('error');
}

async function doReseni(form) {
  const inp = document.getElementById('in-reseni');
  const value = inp.value;
  const succ = await doGameAction('sol', value);
  if(!succ) {
    document.getElementById('sad-reseni').checked = true;
    inp.value = value;
    inp.classList.add('error');
    inp.focus();
  }
}

function doGame(id) {
  switch(id) {
    case 'ak-refresh':
      useCachedLogin();
      break;
    case 'ak-reset':
      doReset();
      break;
    case 'b-napoveda':
    case 'b-poloha':
    case 'b-postup':
      const type = id2en[id.substring(2)];
      doGameAction(type);
      break;
    case 'sad-reseni':
      document.getElementById('in-reseni').focus();
      break;
  }
}

async function doGameAction(type, text) {
  const mark = id => document.getElementById(id)?.classList.add('new')
  try {
    const stan = document.getElementById('stanName').textContent;
    const data = {
      name: localStorage['teamName'],
      passwordHash: localStorage['passwordHash'],
      adminHash: localStorage['adminHash'],
      stan,
      type,
      text
    };
    const row = await serverRequest('g:action', data);
    if(!row.added || row.seq !== game.actions.length + 1) {
      useCachedLogin();
      return;
    }
    game.actions.push(row);
    game.summary = {...game.summary, ...row.changes};
    if(row.opens) {
      const next = document.getElementById(`st-${row.opens}`);
      next.disabled = false;
      next.checked = true;
      updStan(next);
      mark('st-poloha-cell');
    } else {
      updStan(stan);
      mark(`st-${en2id[type]}-text`);
    }
    updScore();
    return row.type !== 'error';
  } catch(error) {
    console.error(error);
    alert(typeof error === 'string' ? error : 'Neznámá chyba');
    useCachedLogin();
  }
}

function copyGPS(elm) {
  const text = elm.dataset.text;
  const popup = document.getElementById('copied');
  navigator.clipboard.writeText(text)
    .then(_ => {
      popup.classList.add('showFlash');
      setTimeout(_ => popup.classList.remove('showFlash'), 500);
    })
    .catch(_ => {});
}

function doReset() {
  serverRequest('g:reset', {
    name: localStorage['teamName'],
    passwordHash: localStorage['passwordHash'],
    adminHash: localStorage['adminHash']
  }).then(useCachedLogin);
}
