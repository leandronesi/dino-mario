# Dino Mario

Platform a scorrimento laterale per bambini, in canvas, senza librerie né
risorse esterne. Il dino corre, salta, schiaccia gli scarabei, colpisce i
blocchi `?` da sotto e arriva alla bandiera. **Venti livelli in cinque mondi**
da quattro, che si aprono uno dopo l'altro: **Il Prato**, **La Grotta**, **Gli Alberi**,
**La Spiaggia**, **Il Vulcano**. Il quarto livello di ogni mondo è un castello: il
Grande Scarabeo sul ponte, la leva che lo fa crollare e un piccolo dino da
liberare, ogni volta di un colore diverso.

- Blocchi `?`: frutti. Il blocco speciale dà il **melone** (il dino diventa
  grande e rompe i mattoni) o, se è già grande, il **peperoncino** (palle di
  fuoco, tasto rosso). La **stella** rende invincibili per qualche secondo.
- La **molla** lancia in alto, sulle assi con i frutti nascosti.
- Nemici: scarabeo, lumaca (il guscio si calcia), uccellini, pipistrelli,
  porcospino (non si schiaccia), gocce di lava (pesci che saltano, nei mondi
  d'acqua), Grande Scarabeo.
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

I livelli stanno in `src/10-levels.js`: quattro disegnati a mano col costruttore
(1-1, 2-1, 3-1, 5-4) e sedici composti da **pezzi** collaudati (`K`: blocchi, tubi,
buche, piattaforme mobili, alberi, scale, molla, castello). Il collaudo lento
esiste per questo: se un livello modificato non si può più finire, `test/smoke.js`
lo dice. Circa 7 minuti per i venti livelli alle due età.

Per rigenerare le icone PNG da `icon.svg`: `node tools/icons.js`.
