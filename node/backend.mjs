import * as fs from 'node:fs/promises';
import * as http from 'node:http';
import normalizeName from './normalize.mjs';
import { dates, teamSize } from '../config.js';

const port = 3000;

let {capacity, teams, numTeams} = await loadTeams();

http.createServer((req, res) => {
  res.setHeader('Content-type', 'application/json');
  let body = '';
  req.on('data', data => body += data);
  req.on('end', () => handle(body).then(({status, reply}) => {
    res.statusCode = status;
    res.end(JSON.stringify(reply));
  }));
}).listen(port, () => console.log(`Server open at ${port}`));

async function handle(body) {
  if(!body)
    return { status: 400 };
  try {
    return { status: 200, reply: await handleObj(JSON.parse(body)) };
  } catch(e) { // catches throws from handleObj as well as JSON parse errors
    console.error(e);
    return { status: 400, reply: typeof e === 'string' ? e : 'Chybný požadavek.' };
  }
}

async function handleObj(request) {
  console.log(request);
  switch(request.type) {
    case 'getTeams': {
      const trans = teams.filter(team => !team.hidden).map(team => ({
          name: team.name,
          members: team.members.map(member => member.name),
          dateReg: team.dateReg,
          dateDue: team.dateDue,
          datePaid: team.datePaid,
          paid: !!team.amountPaid
        }));
      return { capacity, teams: trans };
    }
    case 'login': {
      const team = findTeam(request.data.name);
      if(!team)
        throw 'Tým nenalezen.';
      else if(!(request.data.passwordHash === team.passwordHash || request.data.passwordHash === teams[0].passwordHash))
        throw 'Chybné přihlašovací údaje.';
      else {
        return {
          name: team.name,
          phone: team.phone,
          email: team.email,
          members: team.members,
          amountPaid: team.amountPaid,
          dateDue: team.dateDue,
          datePaid: team.datePaid
        };
      }
    }
    case 'register': {
      const team0 = request.data;
      if(!(typeof team0.name === 'string' && team0.name.trim() !== '' && team0.name.length <= 50
        && typeof team0.email === 'string' && team0.email.trim() !== ''
        && typeof team0.passwordHash === 'string' && team0.passwordHash.length == 64
        && typeof team0.phone === 'string' && team0.phone.trim() !== ''
        && typeof team0.members === 'object' && team0.members.length >= 1 && team0.members.length <= teamSize
        && team0.members.every(member => typeof member === 'string' && member.trim() !== '' && member.length <= 30)
      ))
        throw 'Chybný požadavek.';
      const now = new Date();
      if(now < dates.regOpen)
        throw 'Registrace ještě nejsou otevřeny.';
      if(now > dates.regClose)
        throw 'Registrace již nejsou otevřeny.';
      if(findTeam(team0.name))
        throw 'Toto jméno týmu není dostupné.';
      const team = {
        name: team0.name.trim(),
        email: team0.email.trim(),
        passwordHash: team0.passwordHash,
        phone: team0.phone.trim(),
        members: team0.members.map(m => ({name: m.trim()})),
        dateReg: now,
        dateDue: numTeams + 1 <= capacity ? dueDate(now) : null
      };
      teams.push(team);
      saveTeams();
      return {
        name: team.name,
        phone: team.phone,
        email: team.email,
        members: team.members,
        amountPaid: team.amountPaid,
        dateDue: team.dateDue,
        datePaid: team.datePaid
      };
    }
    case 'update': {
      const now = new Date();
      if(now > dates.changesClose)
        throw 'Změny již nejsou povoleny.';
      const team = findTeam(request.data.name);
      if(!team)
        throw 'Tým nenalezen.';
      const data = request.data;
      if(data.passwordHash !== team.passwordHash && data.passwordHash !== teams[0].passwordHash)
        throw 'Neautorizovaný požadavek.';
      if(!(
        (!data.newPasswordHash || (typeof data.newPasswordHash === 'string' && data.newPasswordHash.length == 64))
        && typeof data.members === 'object' && data.members.length <= teamSize
        && data.members.every(member => typeof member.name === 'string' && member.name.trim() !== '' && member.name.length <= 30)
      ))
        throw 'Chybný požadavek.';
      if(data.members.length === 0)
        throw 'Nelze uložit prázdný tým. Jestli potřebujete zrušit účast, napište organizátorům.';
      if(typeof data.phone === 'string' && data.phone.trim() !== '')
        team.phone = data.phone.trim();
      if(typeof data.email === 'string' && data.email.trim() !== '')
        team.email = data.email.trim();
      if(typeof data.newPasswordHash === 'string' && data.newPasswordHash.length == 64)
        team.passwordHash = data.newPasswordHash;
      for(const m of data.members)
        m.name = m.name.trim();
      team.members = data.members;
      saveTeams();
      return;
    }
    case 'a:getTeams': {
      if(request.data.passwordHash !== teams[0].passwordHash)
        throw 'Neautorizovaný požadavek.';
      return teams;
    }
    case 'a:update': {
      const data = request.data;
      if(data.passwordHash !== teams[0].passwordHash)
        throw 'Neautorizovaný požadavek.';
      const team = findTeam(request.data.name);
      if(!team)
        throw 'Tým nenalezen.';
      team[data.field] = data.value;
      if(data.field === 'amountPaid') {
        if(data.value && !team.datePaid)
          team.datePaid = new Date();
        else if(!data.value)
          delete team.datePaid;
      }
      saveTeams();
      return;
    }
    case 'a:reload': {
      if(request.data.passwordHash !== teams[0].passwordHash)
        throw 'Neautorizovaný požadavek.';
      ({ capacity, teams, numTeams } = await loadTeams());
      return;
    }
    default:
      throw 'Neznámý požadavek.';
  }
}

async function loadTeams() {
  try {
    const { capacity, teams } = await fs.readFile('teams.json').then(data => JSON.parse(data));
    for(const team of teams) {
      if(team.dateReg) team.dateReg = new Date(team.dateReg);
      if(team.datePaid) team.dateReg = new Date(team.datePaid);
      if(team.dateDue) team.dateReg = new Date(team.dateDue);
    }
    const numTeams = teams.filter(team => !team.hidden).length;
    return { capacity, teams, numTeams };
  } catch(e) {
    console.error(e);
    throw 'Chyba při načítání týmů!';
  }
}

function saveTeams() {
  fs.writeFile('teams.json', JSON.stringify({capacity, teams}, null, 2));
  numTeams = teams.filter(team => !team.hidden).length;
}

function findTeam(name) {
  if(typeof name !== 'string' || !name)
    return null;
  return teams.find(team => normalizeName(team.name) === normalizeName(name));
}

function updateDueDates() {
  const now = new Date();
  for(const team in teams) {
    if(team.dateDue < now) {
      team.dateReg = team.dateDue;
      team.dateDue = numTeams <= capacity ? dueDate(team.dateReg) : null;
    }
  }
}

function dueDate(date) {
  const due = new Date(date);
  due.setDate(due.getDate() + 5);
  due.setHours(23, 59, 59, 999);
  return due;
}
