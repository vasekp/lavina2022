let knownNames = [];

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

function normalizeName(name) {
  // TODO more normalization?
  return name.trim().toLowerCase();
}

async function submitForm(form, ev) {
  ev.preventDefault();
  switch(form.id) {
    case 'login':
      doLogin(form);
      break;
  }
}

async function serverRequest(type, data) {
  const rqParcel = {type, data};
  console.log('REQUEST: ', rqParcel);
  const response = await fetch('backend.php', { method: 'POST', body: JSON.stringify(rqParcel) })
    .then(res => res.json())
    .catch(_ => { throw { result: 'error', error: 'Chyba na straně serveru.' }; });
  console.log('RESPONSE: ', response);
  if(response.result === 'ok')
    return response.data;
  else
    throw response;
}

async function doLogin(form) {
  const password = form.querySelector('[name="heslo"]').value;
  try {
    const data = await serverRequest('login', {name: 'admin', password});
    localStorage['adminKey'] = data.authKey;
    document.getElementById('tab-auth').dataset.auth = 1;
    loadTeams();
  } catch(response) {
    console.error(response);
    alert(response.error || 'Neznámá chyba');
  }
}

async function useCachedLogin() {
  const authKey = localStorage['adminKey'];
  if(!authKey)
    return;
  try {
    await serverRequest('login', {name: 'admin', authKey});
    document.getElementById('tab-auth').dataset.auth = 1;
    loadTeams();
  } catch(response) {
    console.error(response);
  }
}

async function loadTeams() {
  const authKey = localStorage['adminKey'];
  if(!authKey)
    return;
  try {
    const teams = await serverRequest('a:getTeams', {authKey});
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
    console.log(tally('tshirt'));
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
      const paid = +team.amountPaid || 0;
      if(paid !== amountDue(team))
        resty.append(newLI(`Tým ${team.name}: má dáti ${amountDue(team)}, dal ${paid}, rozdíl ${amountDue(team) - paid}`));
      if(team.members.some(member => !member.tshirt))
        resty.append(newLI(`Tým ${team.name}: vybrat trička`));
      if(team.members.some(member => !member.meal1 || !member.meal2))
        resty.append(newLI(`Tým ${team.name}: vybrat jídlo`));
    }

  } catch(response) {
    console.error(response);
    alert(response.error || 'Neznámá chyba');
  }
}

async function doAdmin(tgt) {
  const authKey = localStorage['adminKey'];
  if(!authKey)
    return;
  if(tgt.dataset.id === 'set-hidden' || tgt.dataset.id === 'set-countin' || tgt.dataset.id === 'update-pay') {
    const record = tgt.closest('.team-record');
    const name = record.querySelector('.name').textContent;
    const [field, value] =
      tgt.dataset.id === 'set-hidden' ? ['hidden', record.querySelector('[data-id="set-hidden"]').checked] :
      tgt.dataset.id === 'set-countin' ? ['countIn', record.querySelector('[data-id="set-countin"]').checked] :
      tgt.dataset.id === 'update-pay' ? ['amountPaid', record.querySelector('[data-id="pay-amount"]').value] : null;
    try {
      await serverRequest('a:update', {authKey, name, field, value});
      loadTeams();
    } catch(response) {
      console.error(response);
      alert(response.error || 'Neznámá chyba');
    }
  } else if(tgt.id === 'reloadFile') {
    try {
      await serverRequest('a:reload', {authKey});
      loadTeams();
    } catch(response) {
      console.error(response);
      alert(response.error || 'Neznámá chyba');
    }
  }
}

function amountDue(team) {
  return 1500 + 1200 * team.members.length + 350 * team.members.map(member => member.tshirt).filter(val => val && val !== 'nic').length;
}
