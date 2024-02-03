Webový systém šifrovací hry [Lavina XVII](https://l17.lhotatrophy.net/) (full stack), 27.1. – 29.1. 2023. Také adaptováno pro [Lavinu XVIII](https://www.lavina18.cz/).

## Základní použití

Toto je poslední "živá" verze. Větev [static](https://github.com/vasekp/lavina2022/tree/static) představuje zmrazení webu po hře.

Backend běží na Node.js (`node/backend.mjs`), ale z technických důvodů má zde přesměrování přes PHP (`backend.php`). Důvodem je, že na stroji, kde backend běžel, nemám – nebo jsem neměl (2023) – HTTPS ani DNS, a prohlížeče odmítají s takovým komunikovat. Server s frontendem obojí má, ale zase ne Node.js, takže frontend komunikuje přes HTTPS s `backend.php` a to všechny požadavky předává dál na "nezabezpečený" server.

Všechna data se ukládají v `node/teams.json`. Pro rozběhnutí je možno použít kopii `teams0.json`. Je hardcodováno, že záznam, který je uveden první, je administrátorský účet. Jeho heslo v `teams0.json` zní `admin-vasek` a v ostrém provozu je samozřejmě potřeba změnit.

Základní data hry se načítají z `config.js`. Tento soubor používá sdíleně frontend i backend.

## Známé limitace

* Soubor `teams.json` se ukládá při každé změně s debounce na několik stovek milisekund. Ruční zásahy do něj je možno načíst za běhu, ale není implementována kontrola, že nějaké změny zrovna nečekají na zápis. Stejně tak není žádné upozornění na možnou ztrátu dat při vypnutí backendu.
* Soubor `config.js` se načítá pouze při startu backendu. Ruční změny v něm vyžadují aktuálně restart.
