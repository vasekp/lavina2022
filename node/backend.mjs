import * as fs from 'node:fs/promises';
import * as http from 'node:http';
import normalizeName from './normalize.mjs';
import { dates, teamSize } from '../config.js';

const port = 3000;

let teams;
await loadTeams();

http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-type', 'application/json');
  let body = '';
  req.on('data', data => body += data);
  req.on('end', () => {
    const reply = (() => {
      try { return handle(JSON.parse(body)); }
      catch(e) { console.log(e); return {result: 'error', error: 'Chybný požadavek.'} };
    })();
    res.end(JSON.stringify(reply));
  });
}).listen(port, () => console.log(`Server open at ${port}`));

function handle(request) {
  const error = text => ({result: 'error', error: text});
  console.log(request);
  switch(request.type) {
    case 'getTeams': {
      const trans = teams.filter(team => !team.hidden).map(team => ({
          name: team.name,
          members: team.members.map(member => member.name),
          dateReg: team.dateReg,
          datePaid: team.datePaid,
          paid: !!team.amountPaid
        }));
      return {result: 'ok', data: {
        capacity: 18,
        teams: trans
      }};
    }
    case 'login': {
      const team = findTeam(request.data.name);
      if(!team)
        return error('Tým nenalezen.');
      else if(!(request.data.passwordHash === team.passwordHash || request.data.passwordHash === teams[0].passwordHash))
        return error('Chybné přihlašovací údaje.');
      else {
        return {result: 'ok', data: {
          name: team.name,
          phone: team.phone,
          email: team.email,
          members: team.members,
          amountPaid: team.amountPaid,
          datePaid: team.datePaid
        }};
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
        return error('Chybný požadavek.');
      const now = new Date();
      if(now < dates.regOpen)
        return error('Registrace ještě nejsou otevřeny.');
      if(now > dates.regClose)
        return error('Registrace již nejsou otevřeny.');
      if(findTeam(team0.name))
        return error('Toto jméno týmu není dostupné.');
      const team = {
        name: team0.name.trim(),
        email: team0.email.trim(),
        passwordHash: team0.passwordHash,
        phone: team0.phone.trim(),
        members: team0.members.map(m => ({name: m.trim()})),
        dateReg: new Date().toISOString()
      };
      teams.push(team);
      saveTeams();
      return {result: 'ok', data: {
        name: team.name,
        phone: team.phone,
        email: team.email,
        members: team.members
      }};
    }
    case 'update': {
      const now = new Date();
      if(now > dates.changesClose)
        return error('Změny již nejsou povoleny.');
      const team = findTeam(request.data.name);
      if(!team)
        return error('Tým nenalezen.');
      const data = request.data;
      if(data.passwordHash !== team.passwordHash && data.passwordHash !== teams[0].passwordHash)
        return error('Neautorizovaný požadavek.');
      if(!(
        (!data.newPasswordHash || (typeof data.newPasswordHash === 'string' && data.newPasswordHash.length == 64))
        && typeof data.members === 'object' && data.members.length <= teamSize
        && data.members.every(member => typeof member.name === 'string' && member.name.trim() !== '' && member.name.length <= 30)
      ))
        return error('Chybný požadavek.');
      if(data.members.length === 0)
        return error('Nelze uložit prázdný tým. Jestli potřebujete zrušit účast, napište organizátorům.');
      if(typeof data.phone === 'string' && data.phone.trim() !== '')
        team.phone = data.phone.trim();
      if(typeof data.email === 'string' && data.email.trim() !== '')
        team.email = data.email.trim();
      if(typeof data.newPasswordHash === 'string' && data.newPasswordHash.length == 64)
        team.passwordHash = data.newPasswordHash;
      data.members.forEach(m => m.name = m.name.trim());
      team.members = data.members;
      saveTeams();
      return {result: 'ok'};
    }
    case 'a:getTeams': {
      if(request.data.passwordHash !== teams[0].passwordHash)
        return error('Neautorizovaný požadavek.');
      return {result: 'ok', data: teams};
    }
    case 'a:update': {
      const data = request.data;
      if(data.passwordHash !== teams[0].passwordHash)
        return error('Neautorizovaný požadavek.');
      const team = findTeam(request.data.name);
      if(!team)
        return error('Tým nenalezen.');
      team[data.field] = data.value;
      if(data.field === 'amountPaid') {
        if(data.value && !team.datePaid)
          team.datePaid = new Date().toISOString();
        else if(!data.value)
          delete team.datePaid;
      }
      saveTeams();
      return {result: 'ok'};
    }
    case 'a:reload': {
      if(request.data.passwordHash !== teams[0].passwordHash)
        return error('Neautorizovaný požadavek.');
      loadTeams();
      return {result: 'ok'};
    }
    default:
      return error('Neznámý požadavek.');
  }
}

async function loadTeams() {
  teams = await fs.readFile('teams.json')
    .then(data => JSON.parse(data))
    .catch(e => { console.log(e); return []; });
  console.log(teams);
}

function saveTeams() {
  fs.writeFile('teams.json', JSON.stringify(teams, null, 2));
  //console.log(teams);
}

function findTeam(name) {
  if(typeof name !== 'string' || !name)
    return null;
  return teams.find(team => normalizeName(team.name) === normalizeName(name));
}
