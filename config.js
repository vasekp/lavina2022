export const teamSize = {min: 3, max: 5};

export const fees = {
  base: 1500,
  member: 1500,
  tshirt: 250
};

export const dates = {
  regOpen: new Date('2022-12-27T12:00:00.000+01:00'), // Zobrazení tabů: Registrace, Přihlášené týmy, Můj tým
  regClose: new Date('2023-01-15T23:59:59.999+01:00'), // Registrace zmizí a nejsou dále přijímány
  changesClose: new Date('2023-01-20T23:59:59.999+01:00'), // Nejde nadále měnit složení týmu a jídla
  tshirtClose: new Date('2023-01-08T23:59:59.999+01:00'), // Nejde nadále měnit trička
  gameOpen: new Date('2023-01-27T20:00:00.000+01:00'), // Zobrazení tabu Hra
  gameStart: new Date('2023-01-27T20:30:00.000+01:00'), // Jde zadávat první odpovědi (prolog)
  gameMain: new Date('2023-01-28T06:30:00.000+01:00'), // Start hry (jen pro info, jinak relevantní game.json)
  gameEnd: new Date('2023-01-28T20:00:00.000+01:00'), // Nejde nadále nic zadávat, tab Hra zůstává
  gameClose: new Date('2023-01-28T23:59:59.999+01:00') // Uzavře se i záložka Hra
};

export const attemptDelay = 60;
