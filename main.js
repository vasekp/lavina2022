let knownNames = [];

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
  for(const elm of document.querySelectorAll('form input, form select')) {
    elm.addEventListener('input', validateField);
    elm.addEventListener('blur', validateField);
  }
  document.addEventListener('submit', ev => submitForm(ev.submitter.form, ev));
  for(const button of document.querySelectorAll('button[type="submit"]'))
    button.addEventListener('click', () => validateForm(button.form));
  document.getElementById('logout').addEventListener('click', logout);
  for(const elm of document.querySelectorAll('#details input[name^="clen"], #details select[name^="tricko"]'))
    elm.addEventListener('input', updateDetailForm);
  document.getElementById('navrh').addEventListener('click', ev => {
    document.getElementById('navrh-div').hidden = false;
    ev.preventDefault();
  });
  document.getElementById('navrh-div').addEventListener('click', ev => ev.currentTarget.hidden = true);
  resetForms();
  updateTeams();
  if(useCachedLogin())
    showTab('auth');
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
  const tgt = ev.currentTarget;
  const form = tgt.form;
  tgt.classList.remove('pristine');
  if(tgt.name === 'nazev')
    validateName(form);
  if(tgt.name === 'heslo1' || tgt.name === 'heslo2')
    validatePassword(form);
  if(tgt.name.substring(0, 4) === 'clen')
    validateSequence(form);
}

function validateName(form) {
  const name = form.querySelector('[name=nazev]');
  if(!name)
    return;
  const exists = knownNames.includes(normalizeName(name.value));
  const newTeam = form.id === 'register';
  if(newTeam && exists)
    name.setCustomValidity('Společenstvo tohoto jména již existuje.');
  else if(!newTeam && !exists)
    name.setCustomValidity('Společenstvo nenalezeno.');
  else
    name.setCustomValidity('');
}

function normalizeName(name) {
  // TODO more normalization?
  return name.trim().toLowerCase();
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

function validateSequence(form) {
  let seq = true;
  for(const i of [1, 2, 3, 4]) {
    const elm = form.querySelector(`[name=clen${i}]`);
    if(!elm)
      return;
    if(seq && !elm.value)
      seq = false;
    if(!seq && elm.value)
      elm.setCustomValidity('Vyplňujte jména hrdinů potupně.');
    else
      elm.setCustomValidity('');
  }
}

function validateForm(form) {
  for(const inp of form.querySelectorAll('input, select'))
    inp.classList.remove('pristine');
  validateName(form);
  validatePassword(form);
  validateSequence(form);
}

function submitForm(form, ev) {
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

function serverRequest(type, data) {
  const rqParcel = {type, data};
  console.log('REQUEST: ', rqParcel);
  const response = mockServer(rqParcel); // TODO real server
  console.log('RESPONSE: ', response);
  if(response.result === 'ok') // TODO: this, or HTTP status
    return response.data;
  else
    throw response;
}

const exampleTeams = JSON.stringify([ {
  name: 'Múzy',
  password: 'muzy',
  phone: '607659467',
  members: [
    {
      name: 'Pedro',
      meal1: 1,
      meal2: 4,
      tshirt: ''
    },
    {
      name: 'Vašek',
      meal1: 2,
      meal2: 4,
      tshirt: 'S'
    },
    {
      name: 'Honza',
      meal1: 1,
      meal2: 3,
      tshirt: 'M'
    }
  ],
  paid: false,
  dateReg: new Date().toISOString()
}, {
  name: 'Hartl',
  password: 'hartl',
  phone: '987654321',
  members: [
    { name: 'Prvok' },
    { name: 'Tečka' },
    { name: 'Šampon' },
    { name: 'Karel' }
  ],
  paid: true,
  dateReg: new Date().toISOString(),
  datePaid: new Date().toISOString()
}, {
  name: 'Tři mušketýři',
  password: '3m',
  phone: '+421542684275',
  members: [
    { name: 'Athos' },
    { name: 'Porthos' },
    { name: 'Aramis' },
    { name: 'd\'Artagnan'}
  ],
  paid: false,
  dateReg: new Date().toISOString()
} ]);

function mockServer(request) {
  const teams = JSON.parse(sessionStorage['teams'] || exampleTeams);
  function findTeam(name) {
    if(!name)
      return null;
    return teams.find(team => normalizeName(team.name) === normalizeName(name));
  }
  switch(request.type) {
    case 'getTeams': {
      const trans = teams.map(team => ({
        name: team.name,
        members: team.members.map(member => member.name),
        dateReg: team.dateReg,
        paid: team.paid || false,
        datePaid: team.datePaid
      }));
      return {result: 'ok', data: trans};
    }
    case 'register': {
      // TODO validation
      const team = request.data;
      team.members = team.members.map(m => ({name: m}));
      teams.push(team);
      sessionStorage['teams'] = JSON.stringify(teams);
      const authKey = 'key'; // TODO: some form of server-checkable checksum
      return {result: 'ok', data: {
        authKey,
        name: team.name,
        phone: team.phone,
        members: team.members
      }};
    }
    case 'login': {
      const team = findTeam(request.data.name);
      if(!team)
        return {result: 'error', error: 'Společenstvo nenalezeno.'};
      else if(request.data.password !== team.password)
        return {result: 'error', error: 'Heslo nesouhlasí.'};
      else {
        const authKey = 'key'; // TODO: some form of server-checkable checksum
        return {result: 'ok', data: {
          authKey,
          name: team.name,
          phone: team.phone,
          members: team.members,
          paid: team.paid || false
        }};
      }
    }
    case 'getTeam': { // TODO merge with 'login', that would accept both password and an existing authKey?
      const team = findTeam(request.data.name);
      if(!team)
        return {result: 'error', error: 'Společenstvo nenalezeno.'};
      // TODO: ověřit authKey
      else {
        return {result: 'ok', data: {
          name: team.name,
          phone: team.phone,
          members: team.members,
          paid: team.paid || false
        }};
      }
    }
    case 'update': {
      const team = findTeam(request.data.name);
      if(!team)
        return {result: 'error', error: 'Společenstvo nenalezeno.'};
      // TODO ověřit authKey
      team.phone = request.data.phone;
      team.members = request.data.members;
      if(request.data.password)
        team.password = request.data.password;
      sessionStorage['teams'] = JSON.stringify(teams);
      return {result: 'ok'};
    }
  }
}

function updateTeams() {
  const teams = serverRequest('getTeams').map(team => ({
    name: team.name,
    members: team.members,
    dateReg: Date.parse(team.dateReg),
    paid: team.paid,
    datePaid: Date.parse(team.datePaid)
  }));
  if(!teams)
    return;
  knownNames = teams.map(team => normalizeName(team.name));
  teams.sort((t1, t2) => {
    if(t1.paid && !t2.paid)
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
}

function doRegister(form) {
  const getField = field => form.querySelector(`[name="${field}"]`).value;
  const members = [];
  for(const i of [1, 2, 3, 4]) {
    const member = getField(`clen${i}`);
    if(member)
      members.push(member);
  }
  const data = serverRequest('register',
    {
      name: getField('nazev'),
      email: getField('email'),
      password: getField('heslo1'),
      phone: getField('telefon'),
      members,
      dateReg: new Date().toISOString()
    }
  );
  updateTeams();
  resetForms();
  localStorage['teamName'] = data.name;
  localStorage['authKey'] = document.getElementById('authKey').innerText = data.authKey;
  loadTeamData(data);
  showTab('auth');
}

function doLogin(form) {
  const getField = field => form.querySelector(`[name="${field}"]`).value;
  try {
    const data = serverRequest('login',
      {
        name: getField('nazev'),
        password: getField('heslo')
      }
    );
    localStorage['teamName'] = data.name;
    localStorage['authKey'] = document.getElementById('authKey').innerText = data.authKey;
    loadTeamData(data);
  } catch(response) {
    console.error(response);
    alert(response.error);
  }
  resetForms();
}

function useCachedLogin() {
  const name = localStorage['teamName'];
  const authKey = localStorage['authKey'];
  if(!name || !authKey)
    return false;
  try {
    data = serverRequest('getTeam', {name, authKey});
    document.getElementById('authKey').innerText = data.authKey;
    loadTeamData(data);
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
  data.members.forEach((member, index) => {
    getField(`clen${index + 1}`).value = member.name;
    getField(`jidlo${index + 1}a`).value = member.meal1 || '';
    getField(`jidlo${index + 1}b`).value = member.meal2 || '';
    getField(`tricko${index + 1}`).value = member.tshirt || '';
  });
  document.getElementById('platba').dataset.paid = +data.paid || 0;
  updateDetailForm();
}

function logout(ev) {
  document.getElementById('authKey').innerText = '';
  delete localStorage['teamName'];
  delete localStorage['authKey'];
  ev.preventDefault()
}

function updateDetailForm() {
  let numPlayers = 0;
  let numTShirts = 0;
  let moreTShirts = false;
  for(const i of [1, 2, 3, 4]) {
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
  const total = 1500 + 1200 * numPlayers + 350 * numTShirts;
  let html = `<b>${total} Kč</b> (1500 / společenstvo + ${numPlayers} × 1200 / hrdina`;
  if(numTShirts > 0)
    html += ` + ${numTShirts} × 350 / tričko`;
  html += ')';
  if(moreTShirts)
    html += ` + případně${numTShirts > 0 ? ' další ' : ' '}trička`;
  document.getElementById('cena').innerHTML = html;
}

function doDetails(form) {
  const getField = field => form.querySelector(`[name="${field}"]`).value;
  try {
    const data = {
      name: document.getElementById('teamName').innerText,
      authKey: document.getElementById('authKey').innerText,
      phone: getField('telefon'),
      members: []
    };
    for(const i of [1, 2, 3, 4]) {
      const name = getField(`clen${i}`);
      if(name)
        data.members.push({
          name,
          meal1: getField(`jidlo${i}a`),
          meal2: getField(`jidlo${i}b`),
          tshirt: getField(`tricko${i}`)
        });
    }
    if(getField('heslo1'))
      data.password = getField('heslo1');
    serverRequest('update', data);
  } catch(response) {
    console.error(response);
    alert(response.error);
  }
  resetForms();
  updateTeams();
  showTab('tymy');
}
