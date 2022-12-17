import { teamSize, fees } from './config.js';

window.addEventListener('DOMContentLoaded', () => {
  {
    const chkbox = document.getElementById('nav-unfold');
    document.querySelector('nav').addEventListener('click', () => {
      chkbox.checked = !chkbox.checked;
    });
  }
  for(const elm of document.querySelectorAll('date-alt')) {
    const open = Date.parse(elm.dataset.open);
    const close = Date.parse(elm.dataset.close);
    const now = Date.now();
    elm.dataset.alt = open && open > now ? 'pre' :
      close && close < now ? 'post' :
        'within';
  }
  for(const elm of document.querySelectorAll('[data-visible-from], [data-visible-until]')) {
    const open = Date.parse(elm.dataset.visibleFrom);
    const close = Date.parse(elm.dataset.visibleUntil);
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
    for(let i = 1; i <= teamSize; i++) {
      const clone = tmp.content.cloneNode(true);
      clone.querySelectorAll('[name]').forEach(elm => elm.name += i);
      tmp.before(clone);
    }
  }
  resetForms();
  updateTeams();
  useCachedLogin().then(ok => { if(ok) showTab('auth'); });
});

function showTab(name) {
  document.getElementById(`sel-${name}`).checked = true;
  document.getElementById('nav-unfold').checked = false;
}

function resetForms() {
  for(const elm of document.querySelectorAll('form input, form select')) {
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
    if(heslo2.value && heslo1.value !== heslo2.value)
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

async function serverRequest(type, data) {
  const rqParcel = {type, data};
  const response = await fetch('backend.php', { method: 'POST', body: JSON.stringify(rqParcel) })
    .then(res => res.json())
    .catch(_ => { throw { result: 'error', error: 'Chyba na straně serveru.' }; });
  if(response.result === 'ok')
    return response.data;
  else
    throw response;
}

async function updateTeams() {
  try {
    const teams = (await serverRequest('getTeams')).map(team => ({...team,
      dateReg: Date.parse(team.dateReg),
      datePaid: Date.parse(team.datePaid)
    }));
    teams.sort((t1, t2) => {
      if(!t1.hidden && t2.hidden)
        return -1;
      else if(t1.paid && !t2.paid)
        return -1;
      else if(!t1.paid && t2.paid)
        return +1;
      else if(t1.paid && t2.paid)
        return t1.datePaid - t2.datePaid;
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
      table.appendChild(tr);
    });
  } catch(response) {
    console.error(response);
    alert(response.error || 'Neznámá chyba');
  }
}

async function doRegister(form) {
  const getField = field => form.querySelector(`[name="${field}"]`).value;
  const members = [];
  for(let i = 1; i <= teamSize; i++) {
    const member = getField(`clen${i}`);
    if(member)
      members.push(member);
  }
  try {
    const data = await serverRequest('register',
      {
        name: getField('nazev'),
        email: getField('email'),
        password: getField('heslo1'),
        phone: getField('telefon'),
        members
      }
    );
    resetForms();
    localStorage['teamName'] = data.name;
    localStorage['authKey'] = data.authKey;
    updateTeams();
    loadTeamData(data);
    showTab('auth');
  } catch(response) {
    console.error(response);
    alert(response.error || 'Neznámá chyba');
  }
}

async function doLogin(form) {
  const getField = field => form.querySelector(`[name="${field}"]`).value;
  try {
    const data = await serverRequest('login',
      {
        name: getField('nazev'),
        password: getField('heslo'),
        authKey: localStorage['adminKey']
      }
    );
    localStorage['teamName'] = data.name;
    localStorage['authKey'] = data.authKey;
    loadTeamData(data);
  } catch(response) {
    console.error(response);
    alert(response.error || 'Neznámá chyba');
  }
  resetForms();
}

async function useCachedLogin() {
  const name = localStorage['teamName'];
  const authKey = localStorage['authKey'];
  if(!name || !authKey)
    return false;
  try {
    const data = await serverRequest('login', {name, authKey});
    loadTeamData(data);
    document.getElementById('tab-auth').dataset.auth = 1;
    return true;
  } catch(response) {
    console.error(response);
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
  data.members.forEach((member, index) => {
    getField(`clen${index + 1}`).value = member.name;
    getField(`jidloPa${index + 1}`).value = member.meal1 || '';
    getField(`jidloSo${index + 1}`).value = member.meal2 || '';
    getField(`tricko${index + 1}`).value = member.tshirt || '';
  });
  document.getElementById('platba').dataset.paid = data.amountPaid ? 1 : 0;
  document.getElementById('tab-auth').dataset.auth = 1;
  updateDetailForm();
}

function logout(ev) {
  delete localStorage['teamName'];
  delete localStorage['authKey'];
  delete document.getElementById('tab-auth').dataset.auth;
  updateTeams();
  ev.preventDefault()
}

function updateDetailForm() {
  let numPlayers = 0;
  let numTShirts = 0;
  let moreTShirts = false;
  for(let i = 1; i <= teamSize; i++) {
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
  let html = `<b>${total} Kč</b> (${fees.base} / společenstvo + ${numPlayers} × ${fees.member} / hrdina`;
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
      authKey: localStorage['authKey'],
      phone: getField('telefon'),
      email: getField('email'),
      members: []
    };
    for(let i = 1; i <= teamSize; i++) {
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
      data.password = getField('heslo1');
    await serverRequest('update', data);
  } catch(response) {
    console.error(response);
    alert(response.error || 'Neznámá chyba');
  }
  resetForms();
  await updateTeams();
  showTab('tymy');
}
