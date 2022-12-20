import { teamSize, fees, dates } from './config.js';
import { hash, hex, serverRequest } from './shared.js';

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
  for(const elm of document.querySelectorAll('date-alt')) {
    const open = dates[elm.dataset.open];
    const close = dates[elm.dataset.close];
    const now = Date.now();
    elm.dataset.alt = open && open > now ? 'pre' :
      close && close < now ? 'post' :
        'within';
  }
  for(const elm of document.querySelectorAll('[data-visible-from], [data-visible-until]')) {
    const open = dates[elm.dataset.visibleFrom];
    const close = dates[elm.dataset.visibleUntil];
    const now = Date.now();
    elm.hidden = open && open > now ? true :
      close && close < now ? true :
        false;
  }
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
  for(const tmp of document.querySelectorAll('template')) {
    for(let i = 1; i <= teamSize.max; i++) {
      const clone = tmp.content.cloneNode(true);
      clone.querySelectorAll('[name]').forEach(elm => elm.name += i);
      tmp.before(clone);
    }
  }
  for(let i = 1; i <= teamSize.min; i++)
    document.querySelector(`#register input[name="clen${i}"]`).required = true;
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
    const data = await serverRequest('register',
      {
        name: getField('nazev'),
        email: getField('email'),
        salt,
        passwordHash,
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
    const data = await serverRequest('login',
      {
        name,
        passwordHash
      }
    );
    localStorage['teamName'] = data.name;
    localStorage['passwordHash'] = passwordHash;
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
  if(!name || !passwordHash)
    return false;
  try {
    const data = await serverRequest('login', {name, passwordHash});
    loadTeamData(data);
    document.getElementById('tab-auth').dataset.auth = 1;
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
    getField(`jidloPa${index + 1}`).value = member.meal1 || '';
    getField(`jidloSo${index + 1}`).value = member.meal2 || '';
    getField(`tricko${index + 1}`).value = member.tshirt || '';
  });
  getField('sdileni').value = data.sharingPreferences || '';
  document.getElementById('platba').dataset.paid = data.amountPaid ? 1
    : data.dateDue ? 0 : -1;
  document.getElementById('termin').textContent = new Date(data.dateDue).toLocaleDateString('cs-CZ', { dateStyle: 'medium' });
  document.getElementById('tab-auth').dataset.auth = 1;
  updateDetailForm();
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
  let moreTShirts = false;
  for(let i = 1; i <= teamSize.max; i++) {
    const inp = document.querySelector(`#details input[name=clen${i}]`);
    const empty = inp.value === '';
    for(const elm of document.querySelectorAll(`#details select[name*="${i}"]`))
      elm.disabled = empty;
    if(!empty) {
      numPlayers++;
      const t = document.querySelector(`#details select[name=tricko${i}]`).value;
      if(!t)
        moreTShirts = true;
      else if(t !== 'nic')
        numTShirts++;
    }
  }
  // recalculate
  const total = fees.base + fees.member * numPlayers + fees.tshirt * numTShirts;
  let html = `<b>${total} Kč</b> (${fees.base} / tým + ${numPlayers} × ${fees.member} / člen`;
  if(numTShirts > 0)
    html += ` + ${numTShirts} × ${fees.tshirt} / tričko`;
  html += ')';
  if(moreTShirts)
    html += ` + případně${numTShirts > 0 ? ' další ' : ' '}trička`;
  document.getElementById('cena').innerHTML = html;
}

async function doDetails(form) {
  const getField = field => form.querySelector(`[name="${field}"]`).value;
  try {
    const data = {
      name: localStorage['teamName'],
      passwordHash: localStorage['passwordHash'],
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
    showTab('tymy');
  } catch(error) {
    console.error(error);
    alert(typeof error === 'string' ? error : 'Neznámá chyba');
  }
}
