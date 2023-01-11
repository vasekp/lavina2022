import * as fs from 'node:fs/promises';
import * as http from 'node:http';
import normalizeName from './normalize.mjs';
import { dates, teamSize } from '../config.js';

const port = 3001;

const points = {
  hint: -2,
  wt: -5,
  loc: -3,
  sol: 100
};

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
      if(updateDueDates())
        saveTeams();
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
    case 'getSalt': {
      const team = findTeam(request.data.name);
      if(!team)
        throw 'Tým nenalezen.';
      return team.salt;
    }
    case 'login': {
      const team = findTeamAndLogin(request.data);
      return {
        name: team.name,
        phone: team.phone,
        email: team.email,
        salt: team.salt,
        members: team.members,
        sharingPreferences: team.sharingPreferences,
        amountPaid: team.amountPaid,
        dateDue: team.dateDue,
        datePaid: team.datePaid,
        adminLogin: request.data.adminHash === teams[0].passwordHash,
        game: teamGameData(team)
      };
    }
    case 'register': {
      const team0 = request.data;
      const hidden = team0.adminHash === teams[0].passwordHash;
      if(!(typeof team0.name === 'string' && team0.name.trim() !== '' && team0.name.length <= 50
        && typeof team0.email === 'string' && team0.email.trim() !== ''
        && typeof team0.salt === 'string' && team0.salt.length == 16
        && typeof team0.passwordHash === 'string' && team0.passwordHash.length == 64
        && typeof team0.phone === 'string' && team0.phone.trim() !== ''
        && typeof team0.members === 'object' && team0.members.length <= teamSize.max
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
      if(team0.members.length < teamSize.min && !hidden)
        throw `Minimální velikost složení týmu je ${teamSize.min}.`;
      const team = {
        name: team0.name.trim(),
        email: team0.email.trim(),
        salt: team0.salt,
        passwordHash: team0.passwordHash,
        phone: team0.phone.trim(),
        members: team0.members.map(m => ({name: m.trim()})),
        dateReg: now,
        dateRegOrig: now,
        dateDue: numTeams + 1 <= capacity ? dueDate(now) : null,
        hidden
      };
      teams.push(team);
      saveTeams();
      return {
        name: team.name,
        phone: team.phone,
        email: team.email,
        salt: team.salt,
        members: team.members,
        amountPaid: team.amountPaid,
        dateDue: team.dateDue,
        datePaid: team.datePaid,
        game: teamGameData(team) // creates empty record
      };
    }
    case 'update': {
      const now = new Date();
      if(now > dates.changesClose)
        throw 'Změny již nejsou povoleny.';
      const data = request.data;
      const team = findTeamAndLogin(data);
      if(!(
        (!data.newPasswordHash || (typeof data.newPasswordHash === 'string' && data.newPasswordHash.length == 64))
        && typeof data.members === 'object' && data.members.length <= teamSize.max
        && data.members.every(member => typeof member.name === 'string' && member.name.trim() !== '' && member.name.length <= 30)
      ))
        throw 'Chybný požadavek.';
      if(data.members.length === 0)
        throw 'Nelze uložit prázdný tým. Jestli potřebujete zrušit účast, napište organizátorům.';
      if(!team.hidden && data.members.length < teamSize.min)
        throw `Minimální velikost složení týmu je ${teamSize.min}.`;
      if(typeof data.phone === 'string' && data.phone.trim() !== '')
        team.phone = data.phone.trim();
      if(typeof data.email === 'string' && data.email.trim() !== '')
        team.email = data.email.trim();
      if(typeof data.newPasswordHash === 'string' && data.newPasswordHash.length == 64)
        team.passwordHash = data.newPasswordHash;
      if(typeof data.sharing === 'string')
        team.sharingPreferences = data.sharing;
      for(const m of data.members)
        m.name = m.name.trim();
      team.members = data.members;
      saveTeams();
      return;
    }
    case 'g:getData': {
      const team = findTeamAndLogin(request.data);
      return teamGameData(team);
    }
    case 'g:action': {
      const now = new Date();
      if(now < dates.gateStart)
        throw 'Hra ještě nezačala.';
      if(now > dates.gameEnd)
        throw 'Hra již skončila.';
      const data = request.data;
      const team = findTeamAndLogin(data);
      const game = teamGameData(team);
      const stan = data.stan;
      const sum = game.summary[stan] || { };
      const act = game.actions;
      switch(data.type) {
        case 'hint': {
          if(sum.hint || sum.wt || sum.sol)
            throw 'Chybný požadavek.';
          const response = 'Text nápovědy';
          return newRow(game, stan, type, { response });
        }
        case 'wt': {
          if(sum.wt || sum.sol)
            throw 'Chybný požadavek.';
          const response = 'Text postupu';
          return newRow(game, stan, type, { response, inval: sum.hint });
        }
        case 'loc': {
          if(sum.sol)
            throw 'Chybný požadavek.';
          const response = 'Text polohy';
          const loc = { lon: 50, lat: 15 };
          return newRow(game, stan, type, { response, loc }); // TODO opens
        }
        case 'sol': {
          if(sum.sol)
            throw 'Chybný požadavek.';
          const response = 'Poloha následujícího';
          const loc = { lon: 50, lat: 15 };
          return newRow(game, stan, type, { response, loc });
        }
        default:
          throw 'Chybný požadavek.';
      }
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
      if(data.field === 'dateReg') {
        team.dateReg = new Date(team.dateReg);
        team.dateDue = dueDate(team.dateReg);
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
      if(team.datePaid) team.datePaid = new Date(team.datePaid);
      if(team.dateDue) team.dateDue = new Date(team.dateDue);
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

function findTeamAndLogin(data) {
  const team = findTeam(data.name);
  if(!team)
    throw 'Tým nenalezen.';
  if(data.passwordHash !== team.passwordHash && data.adminHash !== teams[0].passwordHash)
    throw 'Chybné přihlašovací údaje.';
  return team;
}

let updateThrottle = null;

function updateDueDates() {
  if(updateThrottle)
    return false;
  const now = new Date();
  let changes = false;
  for(const team of teams) {
    if(!team.datePaid && team.dateDue && team.dateDue < now) {
      team.dateReg = team.dateDue;
      team.dateDue = numTeams <= capacity ? dueDate(team.dateReg) : null;
      changes = true;
    }
  }
  updateThrottle = setTimeout(() => updateThrottle = null, 1000);
  return changes;
}

function dueDate(date) {
  const due = new Date(date);
  due.setDate(due.getDate() + 5);
  due.setHours(23, 59, 59, 999);
  return due;
}

function teamGameData(team) {
  if(!team.game)
    team.game = {
      summary: { },
      actions: [ ]
    };
  return team.game;
}

function newRow(game, row, stan, type, data) {
  row = { seq: game.actions.length + 1, time: now, stan, type, pts: points[type], ...data };
  game.actions.push(row);
  if(!game.summary[stan])
    game.summary.stan = { };
  game.summary[stan][type] = row.seq;
  // TODO save
  return row;
}
