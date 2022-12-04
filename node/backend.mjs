import * as fs from 'node:fs/promises';
import * as http from 'node:http';
import { randomUUID } from 'node:crypto';
import normalizeName from './normalize.mjs';

/* TODO: hlídat termíny */

const port = 3000;
const regOpen = new Date('2022-12-24T00:00:00.000+01:00');
const regClose = new Date('2022-12-24T23:59:59.999+01:00');

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
      return {result: 'ok', data: trans};
    }
    case 'login': {
      const team = findTeam(request.data.name);
      if(!team)
        return error('Společenstvo nenalezeno.');
      else if(!(request.data.password === team.password || request.data.authKey === team.authKey || request.data.authKey === teams[0].authKey))
        return error('Chybné přihlašovací údaje.');
      else {
        return {result: 'ok', data: {
          authKey: team.authKey,
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
      if(!(typeof team0.name === 'string' && team0.name !== '' && team0.name.length <= 50
        && typeof team0.email === 'string' && team0.email !== ''
        && typeof team0.password === 'string' && team0.password.length <= 32
        && typeof team0.phone === 'string' && team0.phone !== ''
        && typeof team0.members === 'object' && team0.members.length >= 1 && team0.members.length <= 4
        && team0.members.every(member => typeof member === 'string' && member !== '' && member.length <= 30)
      ))
        return error('Chybný požadavek.');
      const now = new Date();
      if(now < regOpen)
        return error('Registrace ještě nejsou otevřeny.');
      if(now > regClose)
        return error('Registrace již nejsou otevřeny.');
      if(findTeam(team0.name))
        return error('Toto jméno týmu není dostupné.');
      const team = {
        name: team0.name,
        email: team0.email,
        password: team0.password,
        authKey: randomUUID(),
        phone: team0.phone,
        members: team0.members.map(m => ({name: m})),
        dateReg: new Date().toISOString()
      };
      teams.push(team);
      saveTeams();
      return {result: 'ok', data: {
        authKey: team.authKey,
        name: team.name,
        phone: team.phone,
        email: team.email,
        members: team.members
      }};
    }
    case 'update': {
      const team = findTeam(request.data.name);
      if(!team)
        return error('Společenstvo nenalezeno.');
      const data = request.data;
      if(data.authKey !== team.authKey)
        return error('Neautorizovaný požadavek.');
      if(!(
        (!data.password || (typeof data.password === 'string' && data.password.length <= 32))
        && typeof data.members === 'object' && data.members.length <= 4
        && data.members.every(member => typeof member.name === 'string' && member.name !== '' && member.name.length <= 30)
      ))
        return error('Chybný požadavek.');
      if(data.members.length === 0)
        return error('Nelze uložit prázdný tým. Jestli potřebujete zrušit účast, napište organizátorům.');
      if(typeof data.phone === 'string' && data.phone !== '')
        team.phone = data.phone;
      if(typeof data.email === 'string' && data.email !== '')
        team.email = data.email;
      if(typeof data.password === 'string' && data.password !== '')
        team.password = data.password;
      team.members = data.members;
      saveTeams();
      return {result: 'ok'};
    }
    case 'a:getTeams': {
      if(request.data.authKey !== teams[0].authKey)
        return error('Neautorizovaný požadavek.');
      return {result: 'ok', data: teams};
    }
    case 'a:update': {
      const data = request.data;
      if(data.authKey !== teams[0].authKey)
        return error('Neautorizovaný požadavek.');
      const team = findTeam(request.data.name);
      if(!team)
        return error('Společenstvo nenalezeno.');
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
      if(request.data.authKey !== teams[0].authKey)
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
