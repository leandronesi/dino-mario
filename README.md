# Dino Mario

Platform a scorrimento laterale per bambini, in canvas, senza librerie né
risorse esterne. Il dino corre, salta, schiaccia gli scarabei, colpisce i
blocchi `?` da sotto e arriva alla bandiera. Quattro mondi, che si aprono uno
dopo l'altro: **Il Prato**, **La Grotta**, **Sugli Alberi**, **Il Vulcano**
(con il Grande Scarabeo sul ponte e un piccolo dino da salvare).

- Blocchi `?`: frutti. Il blocco speciale dà il **melone** (il dino diventa
  grande e rompe i mattoni) o, se è già grande, il **peperoncino** (palle di
  fuoco, tasto rosso). La **stella** rende invincibili per qualche secondo.
- Nemici: scarabeo, lumaca (il guscio si calcia), uccellini, pipistrelli,
  porcospino (non si schiaccia), gocce di lava, Grande Scarabeo.
- Cuori, non vite: tre all'inizio, fino a cinque. Un urto costa un cuore, o
  solo la taglia se si è grandi. Ogni 25 frutti un cuore in più. Finiti i
  cuori si riparte dalla bandierina a metà livello. Nessun timer.
- **Piccolo** (3 anni): nemici più lenti, salto più indulgente, porcospini
  sostituiti da scarabei, e cadere in una buca non costa niente: il dino
  torna sull'ultimo terreno sicuro. **Grande** (6 anni): una buca costa un
  cuore, e ci sono nemici in più.

Comandi: frecce grandi a sinistra, salto a destra (anche toccando ovunque
nella metà destra dello schermo); si possono usare due dita insieme. Su PC
frecce o A/D, spazio o su per saltare, X per il fuoco, Esc per la pausa.

L'accesso è quello di tutta la collezione: nome, dino colorato, età e tre
figure facoltative. Progressi locali e separati per profilo (chiavi `dm.`).

```
node build.js
node test/smoke.js         # ~4 minuti: un bot gioca ogni livello, per entrambe le età
node test/smoke.js quick   # solo le regole
node test/look.js          # Chrome vero: fotogrammi in test/frames e tocco a più dita
```

I livelli stanno in `src/10-levels.js`, scritti con un piccolo costruttore
(terreno, buche, tronchi, blocchi, nemici) invece che in ASCII. Il collaudo
lento esiste per questo: se un livello modificato non si può più finire,
`test/smoke.js` lo dice.
