# CRDT Design — Fase 2

Dit document legt uit welke CRDT-aanpak we hebben gekozen, waarom, en wat de bekende beperkingen zijn van deze eerste versie.

---

## 1. Gekozen CRDT-type: LWW Map (Last-Write-Wins Register Map)

### Wat is het?

Een LWW Map is een state-based CRDT (ook wel CvRDT: Convergent CRDT) waarbij elk veld van een document een eigen **LWW Register** heeft. Een LWW Register slaat één waarde op samen met de timestamp van de laatste schrijfoperatie. Bij een merge wint de waarde met de recentste timestamp.

Omdat elk veld onafhankelijk wordt bijgehouden, kan peer-A een nieuwere *title* hebben terwijl peer-B een nieuwere *content* heeft — beide worden na merge correct behouden.

### Vergeleken met alternatieven

| Type | Beschrijving | Reden om nu niet te kiezen |
|------|-------------|---------------------------|
| **Grow-only Set (G-Set)** | Elementen kunnen alleen worden toegevoegd | Te beperkt voor notes; verwijderen is onmogelijk |
| **2P-Set** | Twee G-sets voor add/remove | Ingewikkelder, eenmalig verwijderen (geen re-add) |
| **OR-Set** | Observered-Remove Set | Goed voor *tags*, maar complexer; overkill als startpunt |
| **RGA / LSEQ** | Character-wise text CRDT | Sterk voor simultane tekstbewerking, maar de implementatie is aanzienlijk complexer. Gepland voor een latere fase. |
| **Op-based CRDT** | Stuurt operaties in plaats van volledige state | Vereist bezorggaranties (exactly-once, causale volgorde). State-based is eenvoudiger te synchroniseren. |
| **LWW Map (gekozen)** | Per-veld timestamp, state-based merge | Simpelste correcte aanpak; bewezen eigenschappen; uitbreidbaar |

### Waarom LWW Map als begin?

1. **Begrijpelijkheid.** De merge-functie past in tien regels en is direct te redeneren over.
2. **Bewijsbare eigenschappen.** Commutatief, idempotent en associatief — dit zijn de drie eisen voor een CvRDT. De tests bewijzen elk hiervan.
3. **Goede basis.** Individuele velden kunnen later worden vervangen door krachtigere CRDTs (bijv. OR-Set voor tags, RGA voor content) zonder de rest te verstoren.
4. **Geen vereiste op transportlaag.** State-based CRDTs kunnen op elk moment worden gesynchroniseerd; we kunnen volledige state uitwisselen via WebRTC, Bonjour, of een relay, zonder bezorggaranties te eisen.

---

## 2. Logische klok: Lamport Timestamps + peer-ID als tiebreaker

### Lamport vs. Vector Clocks

| Eigenschap | Lamport Timestamp | Vector Clock |
|-----------|-------------------|--------------|
| Grootte | 1 getal | 1 getal per peer |
| Detecteert gelijktijdigheid | Nee — alleen partiële causaliteit | Ja |
| Tiebreaker nodig voor LWW? | Ja (peer-ID) | Ja (alsnog) |
| Geschikt voor LWW | ✅ | ✅ maar overkill |

Voor LWW hebben we geen echte concurrentie-detectie nodig — we willen alleen "welke write is later?" kunnen beantwoorden. Lamport timestamps geven een **totale volgorde** als we een stabiele tiebreaker toevoegen (peer-ID). Vector Clocks zouden ons vertellen *wanneer* twee writes concurrent zijn, maar we zouden alsnog een tiebreaker nodig hebben. We gaan dus voor de eenvoudigere keuze.

### Hoe het werkt

```
LWWTimestamp = { lamport: number, peerId: string }
```

**Lokale schrijfoperatie:**
```
klok := klok + 1
schrijf waarde met { lamport: klok, peerId: mijn-id }
```

**Na ontvangst van remote state:**
```
klok := max(lokale klok, ontvangen lamport) + 1
```
Dit garandeert dat elke volgende lokale event een hogere timestamp krijgt dan alles wat al gezien is.

**Conflictresolutie:**
1. Hogere `lamport` wint (causale of toevallig latere write)
2. Bij gelijke `lamport`: lexicografisch grotere `peerId` wint

De tiebreaker is willekeurig maar **stabiel** — elke peer past dezelfde vergelijking toe en komt altijd tot dezelfde winnaar.

---

## 3. Bewezen CRDT-eigenschappen

De unit tests in `src/crdt/__tests__/lww.test.ts` bewijzen voor elke eigenschap meerdere gevallen:

### Commutatief: `merge(A, B) ≡ merge(B, A)`

Peer-A ontvangt B's state en peer-B ontvangt A's state → beide komen op hetzelfde document uit. Dit is de convergentie-garantie.

```
// Geconcurreerde writes op lamport=1:
peer-A: title = "Written by peer-A"
peer-B: title = "Written by peer-B"

merge(A, B).title == merge(B, A).title == "Written by peer-B"
```
(peer-B wint de tie lexicografisch)

### Idempotent: `merge(A, A) ≡ A`

Een tweede sync van hetzelfde document verandert niets. Dit betekent dat we berichten/state rustig meerdere keren mogen ontvangen zonder het document te beschadigen.

### Associatief: `merge(merge(A, B), C) ≡ merge(A, merge(B, C))`

Drie peers die in elke willekeurige volgorde samenvoegen komen altijd op hetzelfde resultaat. Dit garandeert convergentie ook als peers in verschillende volgorde met elkaar synchroniseren.

---

## 4. Bekende beperkingen van versie 1

### 4a. Content en tags zijn atomisch (geheel-veld LWW)

De zwaarste beperking: als peer-A en peer-B **tegelijkertijd** dezelfde notitie bewerken (bijv. allebei een alinea toevoegen), wint één versie en gaat de andere verloren. Er is geen character-level merging.

**Wat je ervaart:** Je typt op twee apparaten tegelijkertijd in dezelfde notitie. Na sync heeft één apparaat een "weggespoelde" wijziging.

**Oplossing later:** Content vervangen door een **RGA** (Replicated Growable Array) of **LSEQ** CRDT die individuele tekens bijhoudt. Dit is de meest complexe stap en staat gepland voor Fase 3.

**Workaround nu:** Dit probleem doet zich alleen voor bij *simultane bewerking van hetzelfde veld*. In de praktijk (één gebruiker op meerdere apparaten) is het risico beperkt — je werkt zelden echt parallel op exact dezelfde notitie. De timestamp zorgt er wel voor dat je altijd weet wat de "winnende" versie is.

### 4b. Tags zijn een atomische lijst, geen set-union

Als peer-A `['draft']` heeft en peer-B `['draft', 'important']` heeft met een latere timestamp, wint peer-B's volledige lijst. Er is geen automatische set-union.

**Oplossing later:** Tags vervangen door een **OR-Set** CRDT die add- en remove-operaties bijhoudt. Dit is relatief eenvoudig en staat hoog op de prioriteitenlijst voor Fase 2.

### 4c. Geen tombstones voor verwijderde notities

Er is nog geen mechanisme om aan andere peers te communiceren "ik heb deze notitie verwijderd". Als peer-A een notitie verwijdert, worden zowel de `Note` als het `LWWDoc` uit de lokale Dexie-database verwijderd — er wordt geen spoor van de verwijdering bewaard.

**Concreet gedrag bij delete-vs-concurrent-edit conflict:**

| Scenario | Wat er gebeurt |
|---|---|
| A verwijdert notitie, B bewerkt daarna | B pusht zijn `LWWDoc` naar A. A heeft geen lokaal doc → `applyRemoteDoc` neemt de remote versie als-is over → notitie wordt **herschapen op A** met B's inhoud. |
| B verwijdert notitie, A bewerkt daarna | A pusht naar B. B heeft geen lokaal doc → zelfde resultaat: notitie wordt **herschapen op B** met A's inhoud. |
| A verwijdert notitie terwijl B offline is | B synchroniseert zodra hij online komt, pusht zijn versie → notitie wordt herschapen op A. |

In alle gevallen wint de *aanwezigheid* van een `LWWDoc` van een verwijdering. Verwijderen is in de huidige versie dus **geen definitieve operatie** zolang een andere peer de notitie nog heeft.

**Waarom dit acceptabel is voor nu:** In een single-user, multi-device context (de beoogde gebruiker van Fase 2) zie je dit gedrag alleen als je een notitie verwijdert op apparaat A terwijl apparaat B offline is en die notitie nog heeft. In de praktijk is dit zeldzaam.

**Oplossing later:** Een tombstone-register bijhouden: bij `deleteNote` schrijf `{ id, deletedAt: LWWTimestamp }` naar een aparte `tombstones`-tabel. Voeg tombstones mee in de CRDT-doc uitwisseling. In `applyRemoteDoc` check je eerst of er een tombstone bestaat met een hogere timestamp dan het inkomende doc — zo ja, negeer het doc (of verwijder het lokaal). Dit vergt een extra tabel en een merge-stap, maar past volledig binnen de bestaande state-based architectuur.

### 4d. Geen peer-identiteit of sleutelbeheer

Elke peer kiest momenteel zelf zijn `peerId`. Er is geen authenticatie. In een p2p-context moet dit later worden gekoppeld aan publieke sleutels (bijv. via libp2p of Noise protocol).

### 4e. Geen transport

De CRDT-module is puur logica. Er is nog geen netwerktransport, peer-discovery of state-uitwisseling. Dit wordt stap-voor-stap toegevoegd in de volgende fases.

---

## 5. Volgende stappen (na review van deze module)

1. **StorageAdapter integratie** — `LWWDoc` opslaan naast de bestaande `Note` in Dexie; bij elke lokale write een `writeField` aanroepen met een geticked clock.
2. **OR-Set voor tags** — Tags migreren van atomische LWW naar een OR-Set.
3. **Transport** — State-uitwisseling via WebRTC datachannel of local network (Bonjour/mDNS via Tauri).
4. **RGA voor content** — Character-level tekst-CRDT voor conflictvrije simultane bewerking.
